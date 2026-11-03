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

// Applies the saved BoardUI theme and glass level before first paint (no flash).
const themeScript = `try{var d=document.documentElement;if(localStorage.getItem("boardui:theme")==="dark")d.classList.add("dark");var g=localStorage.getItem("finansial:glass");if(g===null&&matchMedia("(prefers-reduced-transparency: reduce)").matches)g="0";if(g!==null)d.style.setProperty("--glass",String(Math.min(Math.max(Number(g),0),100)/100))}catch(e){}`;

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
