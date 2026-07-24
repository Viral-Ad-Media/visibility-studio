import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Visibility Studio",
  description:
    "Turn any local-business niche into a scored prospect list with ready-to-send outreach — visibility audits, homepage redesign concepts, and booking links, generated for you.",
};

// Fonts + the <html>/<body> shell live here so both the public marketing
// site and the private /app cockpit share them — each section supplies its
// own chrome (marketing nav+footer vs. cockpit sidebar) in a nested layout.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
