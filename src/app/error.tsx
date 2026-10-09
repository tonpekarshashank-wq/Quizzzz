"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="card status-page">
      <h1>Let's try that again.</h1>
      <p>We couldn't load this page. Your saved work is still there.</p>
      <button className="button primary" onClick={reset}>
        Retry
      </button>
    </main>
  );
}
