import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { GlobalNav } from "@/components/global-nav";

export const metadata: Metadata = {
  title: "智能穿搭推荐系统",
  description: "AI Powered Fashion Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      {/* 移除 Inter 引用，直接使用 font-sans (Tailwind 自带系统字体栈) */}
      <body className={cn("min-h-screen bg-black font-sans antialiased")}>
        {children}
      </body>
    </html>
  );
}