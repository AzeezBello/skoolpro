import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Space_Grotesk } from "next/font/google";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata = {
  title: "SkoolPro",
  description: "School Information Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontSans.variable} font-sans min-h-screen bg-background text-foreground antialiased`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
