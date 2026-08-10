import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://appbk.com"),
  title: "appbk — App 决策 Agent",
  description: "连接 App Store 数据，每天告诉你下一步该做什么。",
  icons: { icon: "/appbk-logo.png", shortcut: "/appbk-logo.png" },
  openGraph: {
    title: "appbk — App 决策 Agent",
    description: "让数据替你观察，让 Agent 帮你决策。",
    url: "https://appbk.com",
    siteName: "appbk",
    locale: "zh_CN",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "appbk — 大模型时代的 App 决策服务" }],
  },
  twitter: { card: "summary_large_image", title: "appbk — App 决策 Agent", description: "让数据替你观察，让 Agent 帮你决策。", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
