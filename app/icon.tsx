import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0d0b",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#2fe0ad",
            boxShadow: "0 0 18px 6px rgba(47,224,173,0.55)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
