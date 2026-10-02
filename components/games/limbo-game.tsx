"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useUserStore } from "@/store/userStore";
import { formatCoins, cn } from "@/lib/utils";
import { LimboEngine } from "@/lib/games/limbo/engine";
import { generateServerSeed, hashServerSeed, generateId } from "@/lib/fairness/rng";

const QUICK_TARGETS = [1.5, 2, 5, 10];
const QUICK_BETS = [100, 500, 1000, 5000];

const PARTICLES = Array.from({ length: 20 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: 4 + Math.random() * 8,
  duration: 0.5 + Math.random() * 0.5,
}));

export default function LimboGame() {
  const user = useUserStore((s) => s.user);
  const playGame = useUserStore((s) => s.playGame);
  const engine = useMemo(() => new LimboEngine(), []);

  const [betAmount, setBetAmount] = useState(100);
  const [targetMultiplier, setTargetMultiplier] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<{
    result: number;
    won: boolean;
    payout: number;
    target: number;
  } | null>(null);
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const [animating, setAnimating] = useState(false);
  const animFrameRef = useRef<number>(0);
  const animStartRef = useRef<number>(0);
  const animDuration = 800;

  const [serverSeed, setServerSeed] = useState(() => generateServerSeed());
  const [clientSeed, setClientSeed] = useState(() => generateId().substring(0, 16));
  const [nonce, setNonce] = useState(0);
  const [prevServerSeedHash, setPrevServerSeedHash] = useState("");

  const [history, setHistory] = useState<{ result: number; won: boolean }[]>([]);

  const winChance = engine.calculateWinChance(targetMultiplier);
  const potentialPayout = engine.calculatePayoutPreview(targetMultiplier, betAmount);

  const animateResult = useCallback(
    (finalResult: number, won: boolean) => {
      setAnimating(true);
      animStartRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - animStartRef.current;
        const progress = Math.min(elapsed / animDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = 1 + (finalResult - 1) * eased;
        setDisplayMultiplier(Math.round(current * 100) / 100);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayMultiplier(finalResult);
          setAnimating(false);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    },
    []
  );

  const handlePlay = useCallback(() => {
    if (!user || betAmount <= 0 || betAmount > user.balance || targetMultiplier < 1.01 || isPlaying) return;

    const newServerSeed = generateServerSeed();
    const hashed = hashServerSeed(serverSeed);
    const newClientSeed = generateId().substring(0, 16);
    const newNonce = nonce + 1;

    setPrevServerSeedHash(hashed);
    setServerSeed(newServerSeed);
    setClientSeed(newClientSeed);
    setNonce(newNonce);

    setIsPlaying(true);
    const { result, won, payout } = engine.play(targetMultiplier, betAmount, newServerSeed, newClientSeed, newNonce);

    playGame("Limbo", betAmount, payout, `Target: ${targetMultiplier.toFixed(2)}x, Result: ${result.toFixed(2)}x`);

    setLastResult({ result, won, payout, target: targetMultiplier });
    setHistory((prev) => [{ result, won }, ...prev].slice(0, 12));
    animateResult(result, won);
    setTimeout(() => setIsPlaying(false), 900);
  }, [user, betAmount, targetMultiplier, isPlaying, playGame, animateResult, serverSeed, clientSeed, nonce, engine]);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const chipColor = (won: boolean, result: number) =>
    won
      ? result >= 10
        ? "bg-warning/15 text-warning border border-warning/30"
        : result >= 2
          ? "bg-success/15 text-success border border-success/30"
          : "bg-success/15 text-success border border-success/30"
      : "bg-danger/15 text-danger border border-danger/30";

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
            <Input
              label="Target Multiplier"
              type="number"
              step="0.01"
              min="1.01"
              max="1000"
              value={targetMultiplier}
              onChange={(e) => setTargetMultiplier(Math.max(1.01, Number(e.target.value)))}
              className="text-center text-2xl font-bold font-[family-name:var(--font-mono)] tabular-nums"
            />

            <div className="flex gap-2">
              {QUICK_TARGETS.map((t) => (
                <Button
                  key={t}
                  variant={targetMultiplier === t ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setTargetMultiplier(t)}
                  disabled={isPlaying}
                  className="font-[family-name:var(--font-mono)] tabular-nums"
                >
                  {t}x
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-canvas-elevated border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-text-disabled mb-1">Win Chance</p>
                <p className="text-lg font-bold text-text-gold tabular-nums font-[family-name:var(--font-mono)]">
                  {winChance < 0.01 ? "<0.01" : winChance.toFixed(2)}%
                </p>
              </div>
              <div className="bg-canvas-elevated border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-text-disabled mb-1">Payout</p>
                <p className="text-lg font-bold text-gold tabular-nums font-[family-name:var(--font-mono)]">
                  {formatCoins(potentialPayout)}
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
              disabled={isPlaying}
              className="font-[family-name:var(--font-mono)] tabular-nums"
            />

            <div className="flex gap-2">
              {QUICK_BETS.map((amt) => (
                <Button
                  key={amt}
                  variant="secondary"
                  size="sm"
                  onClick={() => setBetAmount(amt)}
                  disabled={isPlaying}
                  className="font-[family-name:var(--font-mono)] tabular-nums"
                >
                  {amt}
                </Button>
              ))}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handlePlay}
              disabled={
                !user ||
                betAmount <= 0 ||
                betAmount > user.balance ||
                targetMultiplier < 1.01 ||
                isPlaying
              }
            >
              {isPlaying ? "Playing..." : "Play"}
            </Button>

            {user && (
              <p className="text-center text-text-secondary text-sm font-[family-name:var(--font-mono)] tabular-nums">
                Balance: {formatCoins(user.balance)}
              </p>
            )}
          </Card>

          {prevServerSeedHash && (
            <Card className="space-y-2">
              <p className="text-xs text-text-disabled uppercase tracking-wider">Previous Server Seed</p>
              <p className="text-xs text-text-secondary font-mono break-all">{prevServerSeedHash}</p>
            </Card>
          )}
        </div>

        {/* Game Area */}
        <div className="flex-1 space-y-4">
          {/* History Strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {history.map((round, i) => (
              <span
                key={i}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap shrink-0 font-[family-name:var(--font-mono)] animate-chip-in",
                  chipColor(round.won, round.result)
                )}
              >
                {round.result.toFixed(2)}x
              </span>
            ))}
            {history.length === 0 && (
              <span className="text-text-disabled text-xs">No rounds played yet</span>
            )}
          </div>

          {/* Display Card */}
          <Card className="relative overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="text-center">
                <p className="text-text-disabled text-sm mb-3 uppercase tracking-wider font-[family-name:var(--font-mono)]">Multiplier</p>
                <div
                  className={cn(
                    "text-8xl font-black tabular-nums transition-colors duration-300 font-[family-name:var(--font-mono)]",
                    animating
                      ? lastResult?.won
                        ? "text-success"
                        : "text-danger"
                      : lastResult
                        ? lastResult.won
                          ? "text-success"
                          : "text-danger"
                        : "text-gold"
                  )}
                >
                  {animating || lastResult ? (
                    <>
                      {displayMultiplier.toFixed(2)}
                      <span className="text-4xl">x</span>
                    </>
                  ) : (
                    <>
                      {targetMultiplier.toFixed(2)}
                      <span className="text-4xl">x</span>
                    </>
                  )}
                </div>
              </div>

              {!animating && lastResult && (
                <div
                  className={cn(
                    "text-lg font-bold px-6 py-2 rounded-xl font-[family-name:var(--font-mono)] tabular-nums",
                    lastResult.won
                      ? "bg-success/10 text-success border border-success/30"
                      : "bg-danger/10 text-danger border border-danger/30"
                  )}
                >
                  {lastResult.won
                    ? `Won ${formatCoins(lastResult.payout)}`
                    : `Lost — result was ${lastResult.result.toFixed(2)}x`}
                </div>
              )}
            </div>

            {animating && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {PARTICLES.map((particle, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full animate-ping"
                    style={{
                      left: `${particle.left}%`,
                      top: `${particle.top}%`,
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      backgroundColor: lastResult?.won ? "#00F5A0" : "#FF3366",
                      opacity: 0.3,
                      animationDuration: `${particle.duration}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
