"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          background: "#0a0d0b",
          color: "#edf3ee",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "#5f6b64" }}>500</span>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, maxWidth: "24rem" }}>
          Something broke — not just this page.
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#a6b3ac", maxWidth: "24rem" }}>
          Refresh, or come back in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            borderRadius: "999px",
            background: "#2fe0ad",
            color: "#04140f",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#5f6b64" }}>
            ref: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
