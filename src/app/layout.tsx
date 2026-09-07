import "./globals.css";
import type { Metadata } from "next";

import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";

import Nav from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import AuthMenu from "@/components/AuthMenu";



const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  title: "TurnTableAI | AI Operations for Multi-Location Restaurants",
  description:
    "Monitor reviews, performance, and operational risk across every restaurant location from one AI command center.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "TurnTableAI | AI Operations for Multi-Location Restaurants",
    description:
      "Monitor reviews, performance, and operational risk across every restaurant location from one AI command center.",
    url: SITE_URL,
    siteName: "TurnTableAI",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TurnTableAI" }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TurnTableAI | AI Operations for Multi-Location Restaurants",
    description:
      "Monitor reviews, performance, and operational risk across every restaurant location from one AI command center.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
<body className="min-h-screen bg-black text-white antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ToastProvider>
            <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-black/50 backdrop-blur">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                <Nav />
                <AuthMenu />
              </div>
            </header>

            {children}
          </ToastProvider>
        </ThemeProvider>

        <Analytics />
      </body>
    </html>
  );
}