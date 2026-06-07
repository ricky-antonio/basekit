import { ImageResponse } from "next/og"

export const alt = "basekit — The foundation every SaaS needs to ship"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const TEAL = "#2DD4BF"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 40 }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map((col) => (
                <div key={col} style={{ width: 22, height: 22, borderRadius: 4, background: TEAL }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 104, letterSpacing: "-0.03em" }}>
          <span style={{ fontWeight: 400 }}>base</span>
          <span style={{ fontWeight: 800, color: TEAL }}>kit</span>
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 36, color: "#A1A1AA" }}>
          The foundation every SaaS needs to ship.
        </div>
      </div>
    ),
    { ...size },
  )
}
