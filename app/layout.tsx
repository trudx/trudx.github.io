//* Components Imports
import Toaster from "@/components/ui/sonner";

import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";

//* Libraries Imports
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import NextTopLoader from "nextjs-toploader";

//* Types Imports
import type { Metadata, Viewport } from "next";

// Fontes da identidade: Geist na interface, Unbounded nos títulos e Geist Mono nos rótulos.
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trudx | Sistema de trabalho para freelancers",
  description:
    "Clientes, tarefas, agenda e financeiro sob uma única ordem, para quem toca o negócio sozinho.",
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
    { media: "(prefers-color-scheme: light)", color: "#e4e4e1" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${unbounded.variable} ${geistMono.variable} h-full antialiased`}
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
