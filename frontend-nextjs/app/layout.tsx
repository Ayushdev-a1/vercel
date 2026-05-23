import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vercel Clone - Deploy Your Projects",
  description: "A Vercel-like platform to deploy your GitHub repositories with real-time logs and deployment tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
