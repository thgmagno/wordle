import type { MetadataRoute } from "next";

/**
 * Next.js App Router's manifest file convention — this is automatically
 * served as /manifest.webmanifest and linked into every page's <head>,
 * no manual <link rel="manifest"> needed. It's what makes the browser
 * offer "Instalar app"/"Adicionar à tela inicial" and controls how the
 * installed app looks (icon, name, theme color, start screen).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wordle Multiplayer",
    short_name: "Wordle",
    description:
      "Jogo multiplayer de palavras em português — adivinhe palavras, compete com amigos e suba no ranking global",
    // Every session starts at the dashboard's own auth redirect for a
    // returning, already-logged-in player — matches what "/" already does
    // for anyone signed in, and sends a signed-out player to the sign-in
    // screen exactly like opening the site normally would.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
