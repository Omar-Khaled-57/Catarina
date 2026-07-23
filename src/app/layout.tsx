import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

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
  title: "Catarina — Devora Team Planner",
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
    images: ["/meta.png"],
  },
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
