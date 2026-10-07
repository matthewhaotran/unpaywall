import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unpaywall — read the article",
  description: "Paste a link, get the article without the paywall.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
