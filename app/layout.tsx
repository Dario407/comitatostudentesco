import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-sans/700.css";
import "@fontsource/instrument-serif/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Comitato Studentesco",
    template: "%s · Comitato Studentesco"
  },
  description: "Presenze e votazioni del Comitato Studentesco"
};

export const viewport: Viewport = {
  themeColor: "#0B1F3A"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
