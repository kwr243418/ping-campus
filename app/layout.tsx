import type { Metadata, Viewport } from "next";
import { AppRuntime } from "@/components/AppRuntime";
import "./globals.css";

export const metadata: Metadata = {
  title: "핑캠퍼스",
  description: "흩어진 교내 행사 공지를 카드로 정리하고, 수업이 끝날 때 알려 드려요.",
  applicationName: "핑캠퍼스",
  appleWebApp: { capable: true, title: "핑캠퍼스", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans antialiased">
        <div className="mx-auto min-h-dvh max-w-[430px] bg-slate-50 shadow-sm">{children}</div>
        <AppRuntime />
      </body>
    </html>
  );
}
