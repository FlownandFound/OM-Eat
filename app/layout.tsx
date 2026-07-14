import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OM-Eat",
  description:
    "Reference guide to what to eat on a turnaround, maintained by BA Euroflyer crew at London Gatwick.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-neutral-300">
          <nav className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 text-sm font-semibold">
            <Link href="/" className="font-mono font-bold">
              OM-Eat
            </Link>
            <span className="flex gap-4">
              <Link href="/destinations" className="underline">
                Destinations
              </Link>
              <Link href="/add" className="underline">
                Add a Find
              </Link>
            </span>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
