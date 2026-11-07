import type { Metadata } from "next";

// The editor page is a Client Component, and metadata only works in Server Components,
// so the page title lives in this layout instead.
export const metadata: Metadata = {
  title: "Schedule Maker",
};

export default function ScheduleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
