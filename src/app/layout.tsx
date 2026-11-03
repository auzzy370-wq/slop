import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { PwaRegister } from "@/components/pwa-register";
import { StoreHygiene } from "@/components/store-hygiene";
import { SocialHydrator } from "@/components/social-hydrator";
import { UploadsHydrator } from "@/components/uploads-hydrator";
import { UploadProgressDock } from "@/components/admin/upload-progress-dock";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { AdsenseScript } from "@/components/ads/adsense-script";
import { MediaKillOnLeave } from "@/components/media-kill-on-leave";
import { DailyDropReminder } from "@/components/feed/daily-drop-reminder";
import "./globals.css";

export const instant = false;

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADS_CLIENT_ID?.trim() ||
  "ca-pub-5591745880216042";

export const metadata: Metadata = {
  title: {
    default: "SLOP — Stories That Keep You Watching",
    template: "%s · SLOP",
  },
  description:
    "Discover original AI-powered short dramas across romance, thriller, revenge, fantasy, and more. Watch anywhere. Get hooked.",
  applicationName: "SLOP",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SLOP",
  },
  other: {
    "google-adsense-account": ADSENSE_CLIENT.startsWith("ca-pub-")
      ? ADSENSE_CLIENT
      : `ca-pub-${ADSENSE_CLIENT}`,
  },
  openGraph: {
    title: "SLOP — Stories That Keep You Watching",
    description:
      "Premium short-form dramas. Find your next obsession.",
    type: "website",
    siteName: "SLOP",
  },
  twitter: {
    card: "summary_large_image",
    title: "SLOP",
    description: "Stories That Keep You Watching.",
  },
};

export const viewport: Viewport = {
  themeColor: "#111116",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--slop-black)] text-white">
        <Suspense fallback={null}>
          <StoreHygiene />
          <UploadsHydrator />
          <SocialHydrator />
          <MaintenanceGate>
            <AnalyticsProvider>
              <MediaKillOnLeave />
              <DailyDropReminder />
              <DesktopNav />
              <main className="min-h-full flex-1">{children}</main>
              <BottomNav />
              <UploadProgressDock />
            </AnalyticsProvider>
          </MaintenanceGate>
        </Suspense>
        <Toaster
          theme="dark"
          position="top-center"
          offset={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
          mobileOffset={{
            top: "max(0.75rem, env(safe-area-inset-top))",
            bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))",
          }}
          toastOptions={{
            className: "slop-toast",
            style: {
              background: "#18181f",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            },
          }}
        />
        <PwaRegister />
        <AdsenseScript />
      </body>
    </html>
  );
}
