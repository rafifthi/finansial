import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/app.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: { default: "Finansial", template: "%s · Finansial" },
  description: "Household money tracker backed by Google Sheets",
  appleWebApp: { capable: true, title: "Finansial", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Applies the theme before first paint (no flash).
// Follows the system unless a "light" or "dark" choice is saved (Settings → Appearance).
const themeScript = `try{var t=localStorage.getItem("boardui:theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background-full text-text-primary">{children}</body>
    </html>
  );
}
