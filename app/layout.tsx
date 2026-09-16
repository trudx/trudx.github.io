//* Components Imports
import Toaster from "@/components/ui/sonner";

import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";

//* Libraries Imports
import { Geist_Mono, Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";

//* Types Imports
import type { Metadata, Viewport } from "next";

// Inter é a fonte da interface do Figma — base da linguagem visual densa e neutra do app.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "trudx | Sistema de trabalho para freelancers",
  description: "Clientes, tarefas, agenda e financeiro sob uma única ordem, para quem toca o negócio sozinho.",
  applicationName: "trudx",
  appleWebApp: {
    capable: true,
    title: "trudx",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <NextTopLoader color="var(--foreground)" showSpinner={false} />
          {children}
          <Toaster position="top-right" />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
