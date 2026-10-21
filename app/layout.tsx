import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

// Hanken Grotesk over the ubiquitous Inter: same neutral, highly legible UI
// sans, with a little more character in the display sizes and tabular-ready
// figures for the score/cost columns.
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const description =
  "Turn any local-business niche into a scored prospect list with ready-to-send outreach — visibility audits, homepage redesign concepts, and booking links, generated for you.";

// Absolute URLs for the social-share image need a base. A missing or
// malformed NEXT_PUBLIC_SITE_URL just falls back to localhost rather than
// failing the build.
function siteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  } catch {
    return new URL("http://localhost:3300");
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Visibility Studio",
  description,
  openGraph: {
    type: "website",
    siteName: "Visibility Studio",
    title: "Visibility Studio",
    description,
  },
  twitter: { card: "summary_large_image" },
};

// Fonts + the <html>/<body> shell live here so both the public marketing
// site and the private /app cockpit share them — each section supplies its
// own chrome (marketing nav+footer vs. cockpit sidebar) in a nested layout.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: themeInitScript adds `light`/`dark` to <html>
    // before React hydrates, so the class differs from the server render.
    <html
      lang="en"
      className={`${sans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
