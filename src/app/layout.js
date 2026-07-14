import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

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
      <body>
        {children}
        <Script 
          src="https://pl30356323.effectivecpmnetwork.com/1f/c1/36/1fc136931a4dbe06351e49326c469a21.js" 
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
