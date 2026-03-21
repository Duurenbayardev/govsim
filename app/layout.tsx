import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { GovChrome } from "@/components/gov-chrome";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans-gov",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif-gov",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GovSim — Парламентын санал хураалт",
  description:
    "Албан ёсны хуралдааны санал хураалт, удирдлага, нийтийн дэлгэцийн дүн.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className={`${sourceSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <GovChrome>{children}</GovChrome>
      </body>
    </html>
  );
}
