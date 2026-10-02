"use client";

import { useState, useMemo, useCallback } from "react";
import { useUserStore } from "@/store/userStore";
import { formatCoins } from "@/lib/utils";
import { generateServerSeed, generateId } from "@/lib/fairness/rng";
import {
  RouletteEngine,
  type BetType,
  type RouletteColor,
  type SpinResult,
} from "@/lib/games/roulette/engine";

const QUICK_BETS = [100, 500, 1000, 5000];

const COLOR_BG: Record<RouletteColor, string> = {
  red: "#FF3366",
  black: "#1A1D30",
  green: "#00F5A0",
};

interface HistoryEntry {
  number: number;
  color: RouletteColor;
}

const BET_OPTIONS: { type: BetType; label: string; color?: string }[] = [
  { type: "red", label: "Red", color: "#FF3366" },
  { type: "black", label: "Black", color: "#1A1D30" },
  { type: "green", label: "Green", color: "#00F5A0" },
  { type: "odd", label: "Odd" },
  { type: "even", label: "Even" },
  { type: "number", label: "Number" },
  { type: "dozen1", label: "1st 12" },
  { type: "dozen2", label: "2nd 12" },
  { type: "dozen3", label: "3rd 12" },
  { type: "column1", label: "Col 1" },
  { type: "column2", label: "Col 2" },
  { type: "column3", label: "Col 3" },
];

export default function RouletteGame() {
  const user = useUserStore((s) => s.user);
  const playGame = useUserStore((s) => s.playGame);
  const engine = useMemo(() => new RouletteEngine(), []);

  const [betAmount, setBetAmount] = useState(100);
  const [betType, setBetType] = useState<BetType>("red");
  const [betNumber, setBetNumber] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    number: number;
    color: RouletteColor;
    won: boolean;
    payout: number;
  } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const balance = user?.balance ?? 0;

  const handleSpin = useCallback(() => {
    if (!user || betAmount <= 0 || betAmount > balance || spinning) return;

    setSpinning(true);
    setLastResult(null);
    setShowResult(false);

    const serverSeed = generateServerSeed();
    const clientSeed = generateId();
    const nonce = Date.now();

    const result = engine.spin(serverSeed, clientSeed, nonce);
    const won = engine.checkWin(betType, result, betNumber);
    const payout = won ? engine.calculatePayout(betType, betAmount, betNumber) : 0;

    const segmentAngle = 360 / 37;
    const targetAngle = result.number * segmentAngle;
    const spins = 5 + Math.floor(Math.random() * 3);
    const finalRotation = wheelRotation + spins * 360 + (360 - targetAngle);

    setWheelRotation(finalRotation);

    setTimeout(() => {
      playGame("Roulette", betAmount, payout, `${result.number} ${result.color}`);
      setLastResult({ number: result.number, color: result.color, won, payout });
      setHistory((prev) => [{ number: result.number, color: result.color }, ...prev].slice(0, 30));
      setSpinning(false);
      setShowResult(true);
    }, 4500);
  }, [user, betAmount, betType, betNumber, spinning, playGame, wheelRotation, balance, engine]);

  return (
    <div className="flex h-full min-h-[600px] flex-col lg:flex-row">
      <div className="flex w-full flex-col gap-3 p-4 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border">
        <div className="rounded-xl bg-canvas-elevated p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
            Bet Type
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {BET_OPTIONS.map((btn) => (
              <button
                key={btn.type}
                onClick={() => setBetType(btn.type)}
                disabled={spinning}
                className="rounded-lg px-2 py-2 text-xs font-semibold transition-all disabled:opacity-40"
                style={{
                  background:
                    betType === btn.type
                      ? btn.color
                        ? btn.color
                        : "#00F5A0"
                      : "#121420",
                  border: `1px solid ${
                    betType === btn.type
                      ? btn.color
                        ? btn.color
                        : "#00F5A0"
                      : "#1E2235"
                  }`,
                  color:
                    betType === btn.type
                      ? btn.type === "black"
                        ? "#FFFFFF"
                        : "#090A0F"
                      : "#8F95B2",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {betType === "number" && (
          <div className="rounded-xl bg-canvas-elevated p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
              Number (0-36)
            </p>
            <input
              type="number"
              min={0}
              max={36}
              value={betNumber}
              onChange={(e) =>
                setBetNumber(Math.min(36, Math.max(0, Number(e.target.value))))
              }
              disabled={spinning}
              className="input-field w-full px-3 py-2.5 text-center font-[family-name:var(--font-mono)] text-lg tabular-nums text-text-primary"
            />
          </div>
        )}

        <div className="rounded-xl bg-canvas-elevated p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
            Bet Amount
          </p>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
            min={1}
            disabled={spinning}
            className="input-field w-full px-3 py-2.5 text-center font-[family-name:var(--font-mono)] text-lg tabular-nums text-text-primary"
          />
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {QUICK_BETS.map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount)}
                disabled={spinning}
                className="rounded-lg border border-border bg-canvas-card px-2 py-1.5 text-[11px] font-semibold tabular-nums text-text-secondary transition-colors hover:border-gold hover:text-gold disabled:opacity-40"
              >
                {amount.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSpin}
          disabled={!user || betAmount <= 0 || betAmount > balance || spinning}
          className="btn-primary w-full py-3.5 text-sm font-bold tracking-wide disabled:opacity-40"
        >
          {spinning ? "Spinning..." : "Spin"}
        </button>

        {user && (
          <div className="text-center text-xs text-text-secondary">
            Balance:{" "}
            <span className="font-[family-name:var(--font-mono)] font-semibold tabular-nums text-gold">
              {formatCoins(balance)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="relative h-72 w-72 md:h-80 md:w-80">
          <div
            className="absolute inset-0 rounded-full border-4 border-border"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinning
                ? "transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                : "none",
            }}
          >
            {Array.from({ length: 37 }).map((_, i) => {
              const color = engine.getColor(i);
              const angle = (i / 37) * 360;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 origin-bottom"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                    width: 2,
                    height: "50%",
                  }}
                >
                  <div
                    className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 text-[10px] font-bold font-[family-name:var(--font-mono)] tabular-nums"
                    style={{ backgroundColor: COLOR_BG[color], color: "#FFFFFF" }}
                  >
                    {i}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
            style={{
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "14px solid #00F5A0",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-canvas-card border-2 border-border" />
          </div>
        </div>

        {showResult && lastResult && (
          <div className="animate-win-flash text-center">
            <div
              className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold font-[family-name:var(--font-mono)] tabular-nums"
              style={{
                backgroundColor: COLOR_BG[lastResult.color],
                color: "#FFFFFF",
                boxShadow: `0 0 30px ${COLOR_BG[lastResult.color]}40`,
              }}
            >
              {lastResult.number}
            </div>
            <p
              className="text-lg font-bold"
              style={{ color: lastResult.won ? "#00F5A0" : "#FF3366" }}
            >
              {lastResult.won
                ? `Won ${formatCoins(lastResult.payout)}!`
                : "Lost"}
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-1.5">
          {history.length === 0 && (
            <p className="text-xs text-text-disabled">No spins yet</p>
          )}
          {history.map((entry, i) => (
            <div
              key={i}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold font-[family-name:var(--font-mono)] tabular-nums animate-chip-in"
              style={{
                backgroundColor: COLOR_BG[entry.color],
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.1)",
                animationDelay: `${i * 30}ms`,
              }}
            >
              {entry.number}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
