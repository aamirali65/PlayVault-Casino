"use client";

import { useSyncExternalStore, useMemo } from "react";
import { Gift, Check, Lock, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useUserStore } from "@/store/userStore";
import { formatCoins } from "@/lib/utils";

const REWARDS = [100, 200, 300, 500, 1000, 2000, 5000];
const DAY_ICONS = ["🪙", "💎", "🎁", "🏆", "💎", "🎁", "👑"];
const STORAGE_KEY = "playvault_daily_rewards";

const EMPTY_DAYS: number[] = [];

let claimedCache: number[] = EMPTY_DAYS;
let claimedRawCache: string | null = null;
const listeners = new Set<() => void>();

function getClaimedDays(): number[] {
  if (typeof window === "undefined") return EMPTY_DAYS;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === claimedRawCache) return claimedCache;
  let next: number[] = EMPTY_DAYS;
  try {
    const data = raw ? (JSON.parse(raw) as { date?: string; claimedDays?: number[] }) : null;
    const today = new Date().toDateString();
    next = data && data.date === today ? (data.claimedDays ?? EMPTY_DAYS) : EMPTY_DAYS;
  } catch {
    next = EMPTY_DAYS;
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

function saveClaimedDays(days: number[]) {
  const raw = JSON.stringify({ date: new Date().toDateString(), claimedDays: days });
  localStorage.setItem(STORAGE_KEY, raw);
  claimedRawCache = raw;
  claimedCache = days;
  notifyClaimed();
}

function subscribeNothing() {
  return () => {};
}

function getCurrentDay(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

export default function RewardsPage() {
  const { toast } = useToast();
  const addCoins = useUserStore((s) => s.addCoins);
  const claimedDays = useSyncExternalStore(subscribeClaimed, getClaimedDays, () => EMPTY_DAYS);
  const currentDay = useSyncExternalStore(subscribeNothing, getCurrentDay, () => 1);

  const totalClaimed = useMemo(
    () => claimedDays.reduce((sum, d) => sum + REWARDS[d - 1], 0),
    [claimedDays]
  );
  const streak = claimedDays.length;

  function claimReward(day: number) {
    if (day !== currentDay || claimedDays.includes(day)) return;
    const amount = REWARDS[day - 1];
    saveClaimedDays([...claimedDays, day]);
    addCoins(amount);
    toast(`+${formatCoins(amount)} claimed!`, "success");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 shadow-[0_0_30px_rgba(255,209,92,0.15)]">
          <Gift className="h-8 w-8 text-gold" />
        </div>
        <h1 className="font-display text-4xl font-extrabold text-text-primary">
          DAILY REWARDS
        </h1>
        <p className="mt-2 text-text-secondary">
          Log in daily to claim escalating rewards
        </p>
      </div>

      <div className="hud-panel p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
              <Zap className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Streak</p>
              <p className="text-lg font-extrabold text-gold">{streak} / 7 Days</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Claimed</p>
              <p className="text-lg font-extrabold text-gold">{formatCoins(totalClaimed)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 w-full h-2 rounded-full bg-surface border border-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-dim via-gold to-gold-bright transition-all duration-500"
            style={{ width: `${(streak / 7) * 100}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-3 md:gap-4 min-w-max md:min-w-0 md:grid md:grid-cols-7">
          {REWARDS.map((amount, i) => {
            const day = i + 1;
            const isClaimed = claimedDays.includes(day);
            const isCurrent = day === currentDay;
            const isLocked = !isClaimed && !isCurrent;

            return (
              <div
                key={day}
                className={`relative flex-shrink-0 w-[130px] md:w-auto gaming-card p-4 flex flex-col items-center text-center transition-all ${
                  isCurrent
                    ? "border-gold/40 shadow-[0_0_30px_rgba(255,209,92,0.15)]"
                    : isClaimed
                    ? "border-emerald/30 opacity-80"
                    : ""
                }`}
              >
                {isCurrent && (
                  <div className="absolute -right-1 -top-1 rotate-45 bg-gradient-to-r from-gold-bright to-gold px-6 py-0.5 text-[9px] font-extrabold text-canvas tracking-wider">
                    TODAY
                  </div>
                )}

                <span className="text-3xl mb-2">{DAY_ICONS[i]}</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Day {day}
                </span>
                <span className={`mt-1 text-xl font-extrabold ${isCurrent ? "text-gold" : isClaimed ? "text-emerald" : "text-text-primary"}`}>
                  {amount.toLocaleString()}
                </span>
                <span className="text-[10px] text-text-muted">Demo Coins</span>

                <div className="mt-3 w-full">
                  {isClaimed ? (
                    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald/10 border border-emerald/20 py-2 text-[10px] font-bold text-emerald uppercase tracking-wider">
                      <Check className="h-3 w-3" />
                      Claimed
                    </div>
                  ) : (
                    <Button
                      variant={isCurrent ? "gold" : "secondary"}
                      size="sm"
                      className="w-full"
                      disabled={!isCurrent}
                      onClick={() => claimReward(day)}
                    >
                      {isCurrent ? "CLAIM REWARD" : "Locked"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hud-panel mt-6 p-5 text-center">
        <p className="text-sm text-text-muted">
          Rewards reset each day. Claim your daily bonus to keep your streak going!
        </p>
        <p className="mt-1.5 text-xs text-text-muted">
          All rewards are Demo Coins — no real money involved.
        </p>
      </div>
    </div>
  );
}
