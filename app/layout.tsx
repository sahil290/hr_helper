import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR Candidate Screener",
  description:
    "Screen candidates: compare a resume to your job description with structured hiring insights.",
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
