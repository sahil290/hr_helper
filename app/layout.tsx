import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AM Talent Hub",
  description:
    "AM Group's proprietary AI recruitment and talent analysis suite.",
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
