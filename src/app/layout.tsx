import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import Image from "next/image";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const teamName = process.env.NEXT_PUBLIC_TEAM_NAME || "Your Team";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Catarina",
    template: "%s | Catarina",
  },
  description:
    `Team planning and progress tracking for ${teamName}.`,
  keywords: ["planning", "team", "goals", "project management"],
  authors: [{ name: teamName }],
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Catarina",
    description: `Team planning and progress tracking for ${teamName}.`,
    url: siteUrl,
    siteName: "Catarina",
    images: [
      {
        url: `${siteUrl}/media/og-image.png`,
        secureUrl: `${siteUrl}/media/og-image.png`,
        type: "image/png",
        width: 580,
        height: 386,
        alt: "Catarina Preview Image",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catarina",
    description: `Team planning and progress tracking for ${teamName}.`,
    images: [`${siteUrl}/media/og-image.png`],
  },
  other: {
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:type": "image/png",
    "og:image:secure_url": `${siteUrl}/media/og-image.png`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#00E8A2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cairo.variable} antialiased min-h-screen`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-bg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              theme="dark"
              position="bottom-right"
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast: "!items-center !gap-3 sm:!gap-4 !px-4 !py-2.5 sm:!px-5 sm:!py-3.5 !w-[calc(100vw-2rem)] sm:!w-[420px] !max-w-full !rounded-2xl !shadow-2xl",
                  icon: "!w-[64px] !h-[64px] sm:!w-[80px] sm:!h-[80px] !min-w-[64px] sm:!min-w-[80px] !m-0 !p-0 shrink-0",
                  content: "!flex-1 !ml-1 sm:!ml-2",
                  title: "!text-base sm:!text-lg !font-bold tracking-tight",
                  description: "!text-xs sm:!text-sm opacity-90 mt-0.5",
                  closeButton: "!bg-surface-elevated !border-border",
                },
              }}
              icons={{
                success: <Image src="/rina/happy.webp" alt="Success" width={100} height={100} className="w-full h-full object-contain drop-shadow-md shrink-0" />,
                error: <Image src="/rina/bug-fix.webp" alt="Error" width={100} height={100} className="w-full h-full object-contain drop-shadow-md shrink-0" />,
                info: <Image src="/rina/think.webp" alt="Info" width={100} height={100} className="w-full h-full object-contain drop-shadow-md shrink-0" />,
                warning: <Image src="/rina/cry.webp" alt="Warning" width={100} height={100} className="w-full h-full object-contain drop-shadow-md shrink-0" />,
              }}
            />
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
