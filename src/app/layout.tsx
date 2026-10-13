import "./globals.css";
import { Toaster } from "react-hot-toast";
import localFont from "next/font/local";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

// Inter carries body copy and data-dense tables; Space Grotesk is reserved
// for headings so the product keeps its distinctive voice. Both are vendored
// (variable latin subsets, SIL Open Font License) so builds never depend on
// reaching Google Fonts.
const fontSans = localFont({
  src: "./fonts/Inter-latin.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const fontDisplay = localFont({
  src: "./fonts/SpaceGrotesk-latin.woff2",
  weight: "300 700",
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: {
    default: "SkoolPro — School management for modern schools",
    template: "%s · SkoolPro",
  },
  description:
    "Admissions, attendance, results, fees, timetable, homework, online exams and parent communication in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SkoolPro", statusBarStyle: "black-translucent" as const },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

// Applied before paint so the chosen theme doesn't flash. Defaults to light;
// the toggle in the dashboard top bar persists the choice.
const themeScript = `(function(){try{var t=localStorage.getItem("skoolpro-theme");if(!t){t="light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){document.documentElement.classList.remove("dark")}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${fontSans.variable} ${fontDisplay.variable} font-sans min-h-screen bg-background text-foreground antialiased`}>
        <LocaleProvider>
          <AuthSessionSync />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: "12px", fontSize: "14px" },
            }}
          />
        </LocaleProvider>
      </body>
    </html>
  );
}
