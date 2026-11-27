import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "刘看山帮你排计划",
  description: "说一个目标，刘看山拆成能做的小任务，每一步都附上知乎上过来人的真实经验。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
