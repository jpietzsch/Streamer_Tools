import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Child pages set their own title, which gets " | Streamer Tools" added.
  title: {
    template: "%s | Streamer Tools",
    default: "Streamer Tools",
  },
  description: "Small browser tools for repetitive streamer tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
