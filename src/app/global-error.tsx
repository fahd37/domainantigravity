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
      <body style={{ background: "#0a0a0a", color: "#e5e5e5", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>Application Error</h1>
          <p style={{ color: "#888", marginBottom: "2rem" }}>{error.message || "A critical error occurred."}</p>
          <button
            onClick={reset}
            style={{ padding: "0.75rem 1.5rem", background: "#6366f1", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
