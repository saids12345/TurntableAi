import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "TurnTable AI",
  description: "AI tools for small restaurants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        {/* Global providers live here */}
        <ToastProvider>
          {/* Top navigation (sticky) */}
          <Nav />

          {/* Page content */}
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}







