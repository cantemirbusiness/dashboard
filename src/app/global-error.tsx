"use client";

/** Last-resort error boundary (errors in the root layout itself). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#1a1a1a", color: "#dcdcdc", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ color: "#a1a1a1", fontSize: 14, margin: "0 0 16px" }}>
              The app hit an unexpected error. Your data is safe — try again, or reload the page.
              {error.digest ? <span style={{ display: "block", marginTop: 8, color: "#909090" }}>Reference: {error.digest}</span> : null}
            </p>
            <button
              onClick={reset}
              style={{ background: "#a091f7", color: "#121018", border: 0, borderRadius: 6, padding: "10px 14px", fontSize: 14, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
