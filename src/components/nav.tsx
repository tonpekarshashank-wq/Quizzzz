"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
export function Nav({ name }: { name?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="nav">
        <Link
          href={name ? "/quizzes" : "/"}
          className="brand"
          aria-label="Quizzzz home"
        >
          quizzzz<span>✳</span>
        </Link>
        <div className="nav-actions">
          <Link className="nav-link" href="/join">
            Join a game
          </Link>
          {name ? (
            <>
              <Link href="/quizzes" className="nav-link">
                My quizzes
              </Link>
              <Link href="/reports" className="nav-link">
                Reports
              </Link>
              <span className="user-name">{name}</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("auth/logout", "POST", {});
                    router.push("/login");
                    router.refresh();
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link className="button secondary small" href="/login">
              Host a quiz ↗
            </Link>
          )}
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
