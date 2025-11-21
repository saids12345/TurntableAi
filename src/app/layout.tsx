// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// 1) next/font – optimized Google font
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

// 3) Theme provider (light/dark toggle ready)
import { ThemeProvider } from "next-themes";

// Your components
import Nav from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import AuthMenu from "@/components/AuthMenu"; // 👈 Added this line

// 2) Metadata & SEO preview
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  title: "TurnTable AI",
  description: "AI tools for small restaurants — automate your sales recap & forecast.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "TurnTable AI",
    description: "AI tools for small restaurants — automate your sales recap & forecast.",
    url: SITE_URL,
    siteName: "TurnTable AI",
    images: [
      // Put an image at public/og-image.png (1200x630). It’s okay if it’s missing for now.
      { url: "/og-image.png", width: 1200, height: 630, alt: "TurnTable AI" },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TurnTable AI",
    description: "AI tools for small restaurants.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

// 4) Vercel Analytics
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* next-themes needs the class on <html>, Tailwind is set to darkMode: "class" */}
      <body className={`${inter.className} bg-black text-white antialiased min-h-screen`}>
        {/* Global providers */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ToastProvider>
            {/* Top navigation (sticky) */}
            <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-black/50 backdrop-blur">
              <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
                {/* Left: Main Nav */}
                <Nav />

                {/* Right: Auth (Sign in / Sign out) */}
                <AuthMenu />
              </div>
            </header>

            {/* Page content */}
            {children}
          </ToastProvider>
        </ThemeProvider>

        {/* First-party lightweight analytics (does nothing locally) */}
        <Analytics />
      </body>
    </html>
  );
}








