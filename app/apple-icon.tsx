import { ImageResponse } from "next/og"

// iOS home-screen icon (no SVG support there) — the 3×3 grid on the brand-dark background.
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: "flex", gap: 10 }}>
              {[0, 1, 2].map((col) => (
                <div key={col} style={{ width: 34, height: 34, borderRadius: 8, background: "#2DD4BF" }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
