"use client";

import { useSyncExternalStore } from "react";
import { Gift, Zap, Star, Calendar, Check, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useUserStore } from "@/store/userStore";
import { formatCoins } from "@/lib/utils";
import type { Promotion } from "@/types";

const ICONS: Record<string, React.ReactNode> = {
  gift: <Gift className="h-6 w-6" />,
  zap: <Zap className="h-6 w-6" />,
  star: <Star className="h-6 w-6" />,
  calendar: <Calendar className="h-6 w-6" />,
};

const PROMOTIONS_DATA: Omit<Promotion, "claimed">[] = [
  {
    id: "daily-bonus",
    title: "Daily Bonus",
    description: "Log in every day to claim your free daily bonus coins.",
    icon: "gift",
    reward: 100,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "weekly-challenge",
    title: "Weekly Challenge",
    description: "Complete 10 games this week to earn a bonus reward.",
    icon: "zap",
    reward: 500,
    expiresAt: new Date(Date.now() + 604800000).toISOString(),
  },
  {
    id: "new-player",
    title: "New Player Reward",
    description: "Welcome to PlayVault! Claim your new player bonus.",
    icon: "star",
    reward: 1000,
    expiresAt: new Date(Date.now() + 2592000000).toISOString(),
  },
  {
    id: "weekend-event",
    title: "Weekend Event",
    description: "Special weekend event with double rewards on all games.",
    icon: "calendar",
    reward: 2000,
    expiresAt: new Date(Date.now() + 172800000).toISOString(),
  },
];

const STORAGE_KEY = "playvault_promotions";

const EMPTY_CLAIMED: string[] = [];
const DAY_MS = 86400000;

const PROMOTIONS = PROMOTIONS_DATA.map((promo) => ({
  ...promo,
  daysLeft: Math.ceil((new Date(promo.expiresAt).getTime() - Date.now()) / DAY_MS),
}));

let claimedCache: string[] = EMPTY_CLAIMED;
let claimedRawCache: string | null = null;
const listeners = new Set<() => void>();

function getClaimed(): string[] {
  if (typeof window === "undefined") return EMPTY_CLAIMED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === claimedRawCache) return claimedCache;
  let next: string[] = EMPTY_CLAIMED;
  try {
    next = raw ? (JSON.parse(raw) as string[]) : EMPTY_CLAIMED;
  } catch {
    next = EMPTY_CLAIMED;
  }
  claimedRawCache = raw;
  claimedCache = next;
  return claimedCache;
}

function subscribeClaimed(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notifyClaimed() {
  listeners.forEach((listener) => listener());
}

function saveClaimed(ids: string[]) {
  const raw = JSON.stringify(ids);
  localStorage.setItem(STORAGE_KEY, raw);
  claimedRawCache = raw;
  claimedCache = ids;
  notifyClaimed();
}

export default function PromotionsPage() {
  const { toast } = useToast();
  const addCoins = useUserStore((s) => s.addCoins);
  const claimedIds = useSyncExternalStore(subscribeClaimed, getClaimed, () => EMPTY_CLAIMED);

  function claimPromo(promo: Omit<Promotion, "claimed">) {
    if (claimedIds.includes(promo.id)) return;
    saveClaimed([...claimedIds, promo.id]);
    addCoins(promo.reward);
    toast(`+${formatCoins(promo.reward)} claimed!`, "success");
  }

  const totalClaimed = PROMOTIONS
    .filter((p) => claimedIds.includes(p.id))
    .reduce((sum, p) => sum + p.reward, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
            <Sparkles className="h-7 w-7 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight">
              <span className="gaming-gradient-text">PROMOTIONS</span>
            </h1>
            <p className="mt-1 text-text-secondary text-sm">Claim exclusive bonuses and rewards</p>
          </div>
        </div>
        {totalClaimed > 0 && (
          <div className="mt-4 inline-flex items-center gap-3 hud-panel rounded-xl px-5 py-3">
            <Coins className="h-5 w-5 text-gold" />
            <span className="text-sm text-text-secondary">Total Claimed:</span>
            <span className="text-sm font-bold text-gold text-glow-gold">{formatCoins(totalClaimed)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {PROMOTIONS.map((promo) => {
          const isClaimed = claimedIds.includes(promo.id);
          const daysLeft = promo.daysLeft;

          return (
            <div
              key={promo.id}
              className={`gaming-card rounded-2xl p-5 flex flex-col ${isClaimed ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                    isClaimed
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-gold/10 text-gold border-gold/20"
                  }`}
                >
                  {ICONS[promo.icon]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold font-display">{promo.title}</h3>
                    {isClaimed && <Badge variant="success">Claimed</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{promo.description}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="hud-panel rounded-lg px-3 py-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Reward</span>
                  <p className="text-lg font-bold text-gold text-glow-gold">{formatCoins(promo.reward)}</p>
                </div>
                <div className="hud-panel rounded-lg px-3 py-2 text-right">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Expires in</span>
                  <p className="text-sm font-medium text-text-primary">{daysLeft} days</p>
                </div>
              </div>

              <div className="mt-4">
                {isClaimed ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-xl bg-success/10 border border-success/20 py-2.5 text-sm font-bold text-success">
                    <Check className="h-4 w-4" />
                    Claimed
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => claimPromo(promo)}
                  >
                    <Gift className="h-4 w-4" />
                    Claim Reward
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
