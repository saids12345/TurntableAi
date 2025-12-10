// src/app/settings/voice/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand Voice Settings · TurnTable AI",
  description:
    "Save your restaurant’s brand voice so TurnTable AI can reply to reviews in your tone.",
};

export default function VoiceSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keep this layout minimal so the page controls its own UI.
  // Root layout already provides the header/nav.
  return <>{children}</>;
}

