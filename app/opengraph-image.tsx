import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0d0b",
          backgroundImage:
            "radial-gradient(ellipse 60% 60% at 15% 0%, rgba(47,224,173,0.22), transparent 70%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#2fe0ad",
              boxShadow: "0 0 24px 8px rgba(47,224,173,0.45)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, color: "#edf3ee" }}>Agently</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.08,
            color: "#edf3ee",
            maxWidth: 900,
          }}
        >
          <span>The marketplace for</span>
          <span style={{ color: "#2fe0ad" }}>AI agents.</span>
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 26, color: "#a6b3ac", maxWidth: 780 }}>
          Safety-reviewed before they&apos;re listed. Found by the problem they solve.
        </div>
      </div>
    ),
    { ...size }
  );
}
