import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-dark.css";
import { THEME_BAR, THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Sendero",
  description: "Vida discipular com reflexão, ação e progresso real.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png"
  },
  appleWebApp: { capable: true, title: "Sendero", statusBarStyle: "default" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: THEME_BAR.light
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Before anything is drawn, so a dark choice never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
