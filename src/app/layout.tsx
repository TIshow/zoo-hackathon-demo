import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐼 レッサーパンダトーク",
  description: "レッサーパンダとの擬似会話を楽しめるWebデモアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}