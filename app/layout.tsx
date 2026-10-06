import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Comitato Studentesco",
    template: "%s · Comitato Studentesco"
  },
  description: "Presenze e votazioni del Comitato Studentesco"
};

export const viewport: Viewport = {
  themeColor: "#173f67"
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
