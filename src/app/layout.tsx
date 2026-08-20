import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin-ext"],
});

export const metadata: Metadata = {
  title: "Wordle Multiplayer",
  description:
    "Jogo multiplayer de palavras em português - adivinhe palavras, compete com amigos e suba no ranking global",
  keywords: ["wordle", "jogo-de-palavras", "português", "multiplayer", "palavras"],
  openGraph: {
    title: "Wordle Multiplayer",
    description: "Adivinhe palavras e compete com amigos",
    type: "website",
  },
  authors: [{ name: "Wordle" }],
  applicationName: "Wordle Multiplayer",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
