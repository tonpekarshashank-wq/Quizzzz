"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ClientError } from "@/lib/client";
import { Blob, Chip } from "./ui";
type Mode = "login" | "register" | "forgot-password" | "reset-password";
const copy = {
  login: ["WELCOME BACK", "Your quizzes missed you.", "Sign in"],
  register: [
    "YOUR NEXT GREAT QUIZ",
    "Let's make some noise.",
    "Create account",
  ],
  "forgot-password": [
    "A FRESH START",
    "Forgot your password?",
    "Send reset link",
  ],
  "reset-password": [
    "A FRESH START",
    "A new password. You're back.",
    "Reset password",
  ],
};
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [resetToken, setToken] = useState("");
  useEffect(() => {
    if (mode === "reset-password") {
      const value = new URLSearchParams(location.hash.slice(1)).get("token");
      if (value) {
        setToken(value);
        history.replaceState(null, "", location.pathname);
      }
    }
  }, [mode]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setFields({});
    const password = String(data.get("password") ?? "");
    if (mode === "reset-password" && password !== data.get("confirm")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ message?: string }>(
        `auth/${mode}`,
        "POST",
        mode === "reset-password"
          ? { token: resetToken, password }
          : {
              email: String(data.get("email") ?? "").trim(),
              password,
              fullName: data.get("fullName"),
            },
      );
      if (mode === "forgot-password")
        setMessage(result.message ?? "Check your email.");
      else if (mode === "reset-password")
        setMessage("Password updated. Sign in with your new password.");
      else {
        router.push("/quizzes");
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ClientError) setFields(e.fields ?? {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-layout">
      <section className="auth-story">
        <Chip>{copy[mode][0]}</Chip>
        <h1>{copy[mode][1]}</h1>
        <p>
          Good questions bring people together.
          <br />
          You bring the questions.
        </p>
        <div className="auth-blobs">
          <Blob body={3} size={130} mood="grin" />
          <Blob body={4} size={110} />
          <Blob body={1} size={100} mood="o" />
        </div>
      </section>
      <section className="card auth-card">
        <h2>
          {mode === "login"
            ? "Sign in to Quizzzz"
            : mode === "register"
              ? "Your host account"
              : mode === "forgot-password"
                ? "Get a reset link"
                : "Choose a new password"}
        </h2>
        {message ? (
          <div role="status">
            <p>{message}</p>
            <Link href="/login" className="button primary">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Your name
                <input
                  name="fullName"
                  autoComplete="name"
                  required
                  maxLength={100}
                  aria-invalid={!!fields.fullName}
                />
                {fields.fullName && (
                  <span className="field-error">{fields.fullName}</span>
                )}
              </label>
            )}
            {mode !== "reset-password" && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  aria-invalid={!!fields.email}
                />
                {fields.email && (
                  <span className="field-error">{fields.email}</span>
                )}
              </label>
            )}
            {mode !== "forgot-password" && (
              <>
                <label>
                  Password
                  <div className="password-field">
                    <input
                      name="password"
                      aria-label="Password"
                      type={show ? "text" : "password"}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      minLength={10}
                      maxLength={128}
                      aria-invalid={!!fields.password}
                    />
                    <button
                      type="button"
                      className="text-button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? "Hide" : "Show"}
                    </button>
                  </div>
                  {fields.password && (
                    <span className="field-error">{fields.password}</span>
                  )}
                </label>
                {mode !== "login" && (
                  <p className="hint">
                    At least 10 characters. Make it a good one.
                  </p>
                )}
              </>
            )}
            {mode === "reset-password" && (
              <label>
                Confirm password
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                />
              </label>
            )}
            {mode === "login" && (
              <Link href="/forgot-password" className="text-link">
                Forgot your password?
              </Link>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || (mode === "reset-password" && !resetToken)}
            >
              {busy ? "One moment…" : copy[mode][2]}
            </button>
            {mode === "reset-password" && !resetToken && (
              <p className="error">
                Open your reset link, or{" "}
                <Link href="/forgot-password">request a new one</Link>.
              </p>
            )}
          </form>
        )}
        {(mode === "login" || mode === "register") && (
          <p className="auth-switch">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <Link href={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
