import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physics Question Bank",
  description: "Cloud backend for reviewed high-school physics questions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
