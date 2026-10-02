"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useUserStore } from "@/store/userStore";
import { formatCoins, cn } from "@/lib/utils";
import { DiceEngine } from "@/lib/games/dice/engine";
import { generateServerSeed, generateId } from "@/lib/fairness/rng";

const QUICK_BETS = [100, 500, 1000, 5000];

interface RollHistory {
  result: number;
  won: boolean;
}

export default function DiceGame() {
  const user = useUserStore((s) => s.user);
  const playGame = useUserStore((s) => s.playGame);
  const engine = useMemo(() => new DiceEngine(), []);

  const [betAmount, setBetAmount] = useState(100);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<"over" | "under">("over");
  const [rolling, setRolling] = useState(false);
  const [displayResult, setDisplayResult] = useState(0);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [history, setHistory] = useState<RollHistory[]>([]);

  const multiplier = engine.calculatePayoutMultiplier(target, mode);
  const winChance = engine.calculateWinChance(target, mode);

  const animateRoll = useCallback(
    (finalResult: number, cb: () => void) => {
      let frame = 0;
      const totalFrames = 30;
      const interval = setInterval(() => {
        frame++;
        if (frame < totalFrames) {
          setDisplayResult(Math.random() * 100);
        } else {
          clearInterval(interval);
          setDisplayResult(finalResult);
          cb();
        }
      }, 40);
      return () => clearInterval(interval);
    },
    []
  );

  const handleRoll = useCallback(() => {
    if (!user || betAmount <= 0 || betAmount > user.balance || rolling) return;

    setRolling(true);
    setLastResult(null);

    const serverSeed = generateServerSeed();
    const clientSeed = generateId();
    const nonce = Date.now();

    const diceResult = engine.roll(target, mode, betAmount, serverSeed, clientSeed, nonce);

    animateRoll(diceResult.result, () => {
      const payout = diceResult.won ? Math.floor(betAmount * diceResult.payoutMultiplier) : 0;
      playGame("Dice", betAmount, payout, `${diceResult.result} vs ${target}`);
      setLastResult({ won: diceResult.won, payout });
      setHistory((prev) => [{ result: diceResult.result, won: diceResult.won }, ...prev].slice(0, 12));
      setRolling(false);
    });
  }, [user, betAmount, target, mode, rolling, playGame, animateRoll, engine]);

  const sliderBg = () => {
    const pct = ((target - 1) / 98) * 100;
    return `linear-gradient(to right, ${mode === "over" ? "#00F5A0" : "#FF3366"} 0%, ${mode === "over" ? "#00F5A0" : "#FF3366"} ${pct}%, #1E2235 ${pct}%, #1E2235 100%)`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-2 text-center mb-4">
        <span className="text-gold font-bold text-sm tracking-wider uppercase font-[family-name:var(--font-mono)]">
          Demo Mode
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Bet Panel */}
        <div className="lg:w-[340px] shrink-0 space-y-4">
          <Card className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("under")}
                disabled={rolling}
                className={cn(
                  "flex-1 h-10 rounded-[12px] font-semibold text-sm transition-all duration-150 cursor-pointer",
                  mode === "under"
                    ? "bg-gold text-canvas"
                    : "bg-canvas-elevated text-text-secondary border border-border hover:border-gold/30"
                )}
              >
                Under
              </button>
              <button
                onClick={() => setMode("over")}
                disabled={rolling}
                className={cn(
                  "flex-1 h-10 rounded-[12px] font-semibold text-sm transition-all duration-150 cursor-pointer",
                  mode === "over"
                    ? "bg-gold text-canvas"
                    : "bg-canvas-elevated text-text-secondary border border-border hover:border-gold/30"
                )}
              >
                Over
              </button>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary">Target: <span className="text-text-primary font-bold tabular-nums font-[family-name:var(--font-mono)]">{target}</span></span>
                <span className="text-text-secondary">
                  {mode === "over" ? `Over ${target}` : `Under ${target}`}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={99}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                disabled={rolling}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: sliderBg() }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-canvas-elevated border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-text-disabled mb-1">Win Chance</p>
                <p className="text-lg font-bold text-text-primary tabular-nums font-[family-name:var(--font-mono)]">
                  {winChance}%
                </p>
              </div>
              <div className="bg-canvas-elevated border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-text-disabled mb-1">Multiplier</p>
                <p className="text-lg font-bold text-gold tabular-nums font-[family-name:var(--font-mono)]">
                  {multiplier}x
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <Input
              label="Bet Amount"
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
              min={1}
              disabled={rolling}
              className="font-[family-name:var(--font-mono)] tabular-nums"
            />

            <div className="flex gap-2">
              {QUICK_BETS.map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={rolling}
                  className="font-[family-name:var(--font-mono)] tabular-nums"
                >
                  {amount}
                </Button>
              ))}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleRoll}
              disabled={!user || betAmount <= 0 || betAmount > (user?.balance ?? 0) || rolling}
            >
              {rolling ? "Rolling..." : "Roll"}
            </Button>

            {user && (
              <p className="text-center text-text-secondary text-sm font-[family-name:var(--font-mono)] tabular-nums">
                Balance: {formatCoins(user.balance)}
              </p>
            )}
          </Card>
        </div>

        {/* Game Area */}
        <div className="flex-1 space-y-4">
          {/* History Strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {history.map((entry, i) => (
              <span
                key={i}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap shrink-0 font-[family-name:var(--font-mono)] animate-chip-in",
                  entry.won
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-danger/15 text-danger border border-danger/30"
                )}
              >
                {entry.result.toFixed(2)}
              </span>
            ))}
            {history.length === 0 && (
              <span className="text-text-disabled text-xs">No rolls yet</span>
            )}
          </div>

          {/* Roll Display */}
          <Card className="relative overflow-hidden">
            <div className="text-center py-16 space-y-6">
              <div
                className={cn(
                  "text-8xl font-black tabular-nums font-[family-name:var(--font-mono)] transition-colors duration-300",
                  rolling
                    ? "text-text-secondary animate-slot-spin"
                    : lastResult
                      ? lastResult.won
                        ? "text-success"
                        : "text-danger"
                      : "text-text-primary"
                )}
              >
                {displayResult.toFixed(2)}
              </div>

              {lastResult && !rolling && (
                <div
                  className={cn(
                    "text-lg font-bold px-6 py-2 rounded-xl font-[family-name:var(--font-mono)] tabular-nums",
                    lastResult.won
                      ? "bg-success/10 text-success border border-success/30"
                      : "bg-danger/10 text-danger border border-danger/30"
                  )}
                >
                  {lastResult.won
                    ? `You won ${formatCoins(lastResult.payout)}!`
                    : "You lost!"}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
