import type { Metadata } from "next";
import { Bungee, Exo_2, Space_Grotesk } from "next/font/google";
import ToastProvider from "@/components/ui/toast";
import MainLayout from "@/components/layout/main-layout";
import "./globals.css";

const bungee = Bungee({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

const exo2 = Exo_2({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlayVault Casino — Play. Compete. Level Up.",
  description:
    "PlayVault Casino is a demo gaming platform where you can play crash games, cards, arcade, dice, slots, and more. Compete in tournaments, climb leaderboards, and level up - all with virtual Demo Coins. No real money involved.",
  keywords: [
    "casino games demo",
    "crash game",
    "provably fair",
    "nextjs gaming platform",
    "browser games",
    "tournaments leaderboard",
  ],
  applicationName: "PlayVault Casino",
  authors: [{ name: "PlayVault" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${exo2.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body bg-canvas text-text-primary">
        <ToastProvider>
          <MainLayout>{children}</MainLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
