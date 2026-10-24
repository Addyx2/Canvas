import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";

const dm = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Aultrum Canvas", template: "%s · Aultrum Canvas" },
  description: "The console for Persona and Elements: Aultrum's AI and care modules inside the systems you already use.",
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dm.variable} ${grotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
