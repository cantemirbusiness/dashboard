import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Progress", template: "%s · Progress" },
  description: "A personal operating system for development: skills, goals, projects and evidence-based progress.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f5" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value;
  const dataTheme = theme === "light" || theme === "system" ? theme : "dark";
  return (
    <html lang="en" data-theme={dataTheme} className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh text-[14px] leading-relaxed">{children}</body>
    </html>
  );
}
