import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
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
  // iOS ignores the web manifest almost entirely — these are what
  // actually make "Adicionar à Tela de Início" open a standalone app
  // window instead of just a Safari bookmark, and set its status-bar
  // style. src/app/apple-icon.png (Next's file convention) supplies the
  // home-screen icon these tags point at.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wordle",
  },
};

// Split from `metadata` per Next.js's viewport API — themeColor here
// tints the browser's own UI (the address bar on mobile, the PWA's
// title bar once installed), matching each header's actual background
// in light/dark mode instead of a single fixed color that would look
// wrong in one of the two themes.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
