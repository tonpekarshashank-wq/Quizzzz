"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { gameApi } from "@/lib/game-client";
import type { TokenRequest } from "ably";
import { ClientError } from "@/lib/client";
import type { Snapshot } from "@/lib/game-model";
import { terminal } from "@/lib/game-model";
export function useGame(id: string, token?: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const loading = useRef(false);
  const queued = useRef(false);
  const realtimeConnected = useRef(false);
  const wakePolling = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const retry = useRef(1500);
  const finished = useRef(false);
  const ended = !!snap && terminal(snap.state);
  const refresh = useCallback(async () => {
    if (loading.current) {
      queued.current = true;
      return;
    }
    loading.current = true;
    try {
      const before = Date.now();
      const next = await gameApi<Snapshot>(
        `sessions/${id}/snapshot`,
        "GET",
        undefined,
        token,
      );
      if (mounted.current) {
        setSnap((previous) =>
          !previous || next.revision >= previous.revision ? next : previous,
        );
        setOffset(
          new Date(next.serverTime).getTime() - (before + Date.now()) / 2,
        );
        setError("");
        finished.current = terminal(next.state);
        retry.current = realtimeConnected.current ? 30000 : 1500;
      }
    } catch (e) {
      if (mounted.current) {
        setError(
          e instanceof ClientError
            ? e.message
            : "Reconnecting… Your place and accepted answers are kept.",
        );
        setFatal(
          e instanceof ClientError &&
            ["GUEST_EXPIRED", "NOT_FOUND", "UNAUTHENTICATED"].includes(e.code),
        );
        if (
          e instanceof ClientError &&
          ["GUEST_EXPIRED", "NOT_FOUND", "UNAUTHENTICATED"].includes(e.code)
        )
          finished.current = true;
        retry.current = Math.min(retry.current * 2, 30000);
      }
    } finally {
      loading.current = false;
      if (queued.current && mounted.current && !finished.current) {
        queued.current = false;
        queueMicrotask(() => void refresh());
      }
    }
  }, [id, token]);
  useEffect(() => {
    mounted.current = true;
    finished.current = false;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      clearTimeout(timer);
      await refresh();
      if (!stopped && !finished.current) {
        clearTimeout(timer);
        timer = setTimeout(poll, retry.current);
      }
    };
    wakePolling.current = () => void poll();
    void poll();
    const tick = setInterval(() => {
      if (!finished.current) setNow(Date.now());
    }, 100);
    const online = () => void refresh();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", online);
    return () => {
      mounted.current = false;
      stopped = true;
      wakePolling.current = null;
      clearTimeout(timer);
      clearInterval(tick);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", online);
    };
  }, [refresh]);
  useEffect(() => {
    if (!snap || fatal || ended) return;
    let closed = false;
    let client: { close: () => void } | undefined;
    void (async () => {
      try {
        const response = await gameApi<{
          mode: "polling" | "ably";
          channel?: string;
          tokenRequest?: unknown;
        }>(`sessions/${id}/realtime-token`, "POST", {}, token);
        if (response.mode !== "ably" || closed) return;
        const Ably = await import("ably");
        if (closed) return;
        const ably = new Ably.Realtime({
          authCallback: async (_params, callback) => {
            try {
              const next = await gameApi<{ tokenRequest: TokenRequest }>(
                `sessions/${id}/realtime-token`,
                "POST",
                {},
                token,
              );
              callback(null, next.tokenRequest);
            } catch (e) {
              callback((e as Error).message, null);
            }
          },
        });
        client = ably;
        const channel = ably.channels.get(response.channel!);
        await channel.subscribe((message) => {
          if (token && message.data?.kind === "ANSWER_COUNT") return;
          void refresh();
        });
        realtimeConnected.current = ably.connection.state === "connected";
        ably.connection.on(() => {
          realtimeConnected.current = ably.connection.state === "connected";
          retry.current = realtimeConnected.current ? 30000 : 1500;
          wakePolling.current?.();
        });
        if (closed) ably.close();
      } catch {
        /* Snapshot recovery continues when the provider is unavailable. */
      }
    })();
    return () => {
      closed = true;
      realtimeConnected.current = false;
      client?.close();
    };
  }, [id, token, snap?.channelVersion, ended, fatal, refresh]);
  const remaining = snap?.question?.endsAt
    ? Math.max(0, new Date(snap.question.endsAt).getTime() - (now + offset))
    : 0;
  return { snap, error, fatal, refresh, remaining };
}
