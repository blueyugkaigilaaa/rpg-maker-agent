import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPG Maker Agent - 一篇文章变成一款游戏",
  description: "给 AI 一篇文章，自动生成一款可以玩的 RPG 游戏",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
