import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://catarina-devora.vercel.app"),
  title: {
    default: "Catarina — Devora Team Planner",
    template: "%s | Catarina",
  },
  description:
    "Monthly planning and progress tracking for the Devora team. Manage goals, track completion, and generate reports.",
  keywords: ["planning", "team", "goals", "devora", "project management"],
  authors: [{ name: "Devora" }],
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://catarina-devora.vercel.app",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Catarina — Devora Team Planner",
    description: "Monthly planning and progress tracking for the Devora team.",
    url: "https://catarina-devora.vercel.app",
    siteName: "Catarina",
    images: [
      {
        url: "/meta.png",
        secureUrl: "https://catarina-devora.vercel.app/meta.png",
        type: "image/png",
        width: 1200,
        height: 630,
        alt: "Catarina Preview Image",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catarina — Devora Team Planner",
    description: "Monthly planning and progress tracking for the Devora team.",
    images: ["https://catarina-devora.vercel.app/meta.png"],
    creator: "@omar_khaled",
  },
  other: {
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:type": "image/png",
    "og:image:secure_url": "https://catarina-devora.vercel.app/meta.png",
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
            />
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
