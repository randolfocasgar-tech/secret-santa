import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { ConfigBanner } from "@/components/config-banner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Amigo Secreto", template: "%s · Amigo Secreto" },
  description: "Organiza tu intercambio de regalos sin papelitos: invita, sortea y descubre a quién te tocó.",
};

export const viewport: Viewport = {
  themeColor: "#143c28",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-pine-800 focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        <ConfigBanner />
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {children}
        </main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          Amigo Secreto · Hecho para reemplazar los papelitos.
        </footer>
      </body>
    </html>
  );
}
