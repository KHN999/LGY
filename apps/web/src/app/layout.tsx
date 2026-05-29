import type { Metadata } from "next";
import { Noto_Sans_Myanmar, Inter } from "next/font/google";
import "./globals.css";

const notoMyanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-myanmar",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LGY",
  description: "Theingyi market longyi management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="my" className={`${notoMyanmar.variable} ${inter.variable}`}>
      <body className="font-myanmar antialiased">{children}</body>
    </html>
  );
}
