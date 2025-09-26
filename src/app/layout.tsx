import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐼 しゃべれっさー！",
  description: "レッサーパンダとの擬似会話を楽しめるWebデモアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}