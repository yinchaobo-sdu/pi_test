import "./globals.css";

export const metadata = {
  title: "皮皮虾大战 - Pipi Shrimp Battle",
  description: "用 Next.js 编写的经典皮皮虾大战游戏",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
