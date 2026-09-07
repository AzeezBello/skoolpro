import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Space_Grotesk } from "next/font/google";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata = {
  title: "SkoolPro",
  description: "School Information Management System",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SkoolPro", statusBarStyle: "black-translucent" as const },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

// Applied before paint so the chosen theme doesn't flash. Defaults to dark,
// the app's original look.
const themeScript = `(function(){try{var t=localStorage.getItem("skoolpro-theme");if(!t){t="dark"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){document.documentElement.classList.add("dark")}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${fontSans.variable} font-sans min-h-screen bg-background text-foreground antialiased`}>
        <LocaleProvider>
          <AuthSessionSync />
          {children}
          <Toaster position="top-right" />
        </LocaleProvider>
      </body>
    </html>
  );
}
