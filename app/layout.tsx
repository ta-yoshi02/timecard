import type { Metadata } from "next";
import "./globals.css";
import 'react-clock/dist/Clock.css';
import AppLayout from "./components/AppLayout";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "勤怠チェックダッシュボード",
  description: "小規模飲食店向けの勤怠確認ダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
