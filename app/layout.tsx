import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ErudaDebug from "@/components/ErudaDebug";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cafe-Brasserie Millewee",
  description: "Brasserie Millewee - Burgers, plats du jour et plus a Luxembourg Gasperich",
  icons: {
    icon: "/images/favicon-48x48.png",
    apple: "/logo2-512x512.PNG",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Millewee",
  },
};

export const viewport = {
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${playfairDisplay.variable} ${dmSans.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerRegistration />
          <ErudaDebug />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
