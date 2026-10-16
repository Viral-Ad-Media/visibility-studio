import { ImageResponse } from "next/og";

// Social-share card for every page that doesn't set its own. Rendered at
// build time; no external fonts or images, so it can't fail on a fetch.
export const alt = "Visibility Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#08090f",
          color: "#f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg
            width="72"
            height="72"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
            <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
            <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
            <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
            <circle cx="12" cy="12" r="2" />
            <path d="m13.41 10.59 5.66-5.66" />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700 }}>Visibility Studio</div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 36,
            lineHeight: 1.35,
            color: "#94a3b8",
            maxWidth: 960,
          }}
        >
          Turn any local-business niche into a scored prospect list with
          ready-to-send outreach.
        </div>
      </div>
    ),
    size,
  );
}
