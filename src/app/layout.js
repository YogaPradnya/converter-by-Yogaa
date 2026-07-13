import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  title: "MKV to MP4 Converter - Batch Video Converter & Smart Rename",
  description:
    "Convert multiple MKV files to MP4 right in your browser with high speed. Customize, preview, and batch-rename your output files using dynamic templates.",
  robots: "index, follow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head />
      <body>{children}</body>
    </html>
  );
}
