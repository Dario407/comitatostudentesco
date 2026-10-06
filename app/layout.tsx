import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat"
});

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
    <html lang="it" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
