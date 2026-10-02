"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useUserStore } from "@/store/userStore";
import { formatCoins, cn } from "@/lib/utils";
import { CrashEngine } from "@/lib/games/crash/engine";
import { generateServerSeed, hashServerSeed, generateId } from "@/lib/fairness/rng";

const QUICK_BETS = [100, 500, 1000, 5000];

type GameState = "idle" | "countdown" | "running" | "crashed" | "cashed_out";

interface RoundResult {
  crashed: boolean;
  multiplier: number;
  profit: number;
}

export default function CrashGame() {
  const user = useUserStore((s) => s.user);
  const playGame = useUserStore((s) => s.playGame);
  const engineRef = useRef(new CrashEngine());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [betAmount, setBetAmount] = useState(100);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const [serverSeed, setServerSeed] = useState(() => generateServerSeed());
  const [clientSeed, setClientSeed] = useState(() => generateId().substring(0, 16));
  const [nonce, setNonce] = useState(0);
  const [prevServerSeedHash, setPrevServerSeedHash] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const drawCanvas = useCallback(
    (multiplier: number, crashed: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = "#090A0F";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const gy = (h / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const maxMult = Math.max(multiplier, 2);
      const elapsed = engineRef.current.elapsed;
      const steps = Math.min(120, Math.floor(elapsed * 12));
      const points: { x: number; y: number }[] = [];
      const maxTime = 10;

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.min(elapsed, maxTime);
        const m = Math.pow(1.0024, (t * 1000) / 25);
        const x = (t / maxTime) * (w - 40) + 20;
        const y = h - 20 - ((m - 1) / (maxMult - 1)) * (h - 40);
        points.push({ x, y: Math.max(20, y) });
      }

      if (points.length < 2) return;

      const lineColor = crashed ? "#FF3366" : "#00F5A0";

      for (let i = 1; i < points.length; i++) {
        const alpha = 0.1 + (i / points.length) * 0.5;
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.strokeStyle = crashed
          ? `rgba(255,51,102,${alpha})`
          : `rgba(0,245,160,${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
      areaGrad.addColorStop(0, crashed ? "rgba(255,51,102,0.25)" : "rgba(0,245,160,0.25)");
      areaGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.moveTo(points[0].x, h);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, h);
      ctx.fillStyle = areaGrad;
      ctx.fill();

      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(last.x, last.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = crashed
        ? "rgba(255,51,102,0.15)"
        : "rgba(0,245,160,0.15)";
      ctx.fill();
    },
    []
  );

  const gameLoop = useCallback(function loop() {
    const engine = engineRef.current;
    const now = performance.now();
    const delta = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = now;

    engine.tick(delta);

    if (engine.checkCrash()) {
      playGame("Crash", betAmount, 0, `Crashed at ${engine.crashPoint.toFixed(2)}x`);
      setCurrentMultiplier(engine.crashPoint);
      drawCanvas(engine.crashPoint, true);
      setGameState("crashed");
      setLastResult({ crashed: true, multiplier: engine.crashPoint, profit: 0 });
      setHistory((prev) => [engine.crashPoint, ...prev].slice(0, 12));
      return;
    }

    setCurrentMultiplier(engine.currentMultiplier);
    drawCanvas(engine.currentMultiplier, false);
    animFrameRef.current = requestAnimationFrame(loop);
  }, [drawCanvas, playGame, betAmount]);

  const prepareRound = useCallback(() => {
    const newServerSeed = generateServerSeed();
    const hashed = hashServerSeed(serverSeed);
    const newClientSeed = generateId().substring(0, 16);
    const newNonce = nonce + 1;

    setPrevServerSeedHash(hashed);
    setServerSeed(newServerSeed);
    setClientSeed(newClientSeed);
    setNonce(newNonce);

    return { serverSeed: newServerSeed, clientSeed: newClientSeed, nonce: newNonce };
  }, [serverSeed, clientSeed, nonce]);

  const startRound = useCallback(() => {
    if (!user || betAmount <= 0 || betAmount > user.balance) return;

    setCountdown(3);
    setGameState("countdown");

    let cd = 3;
    countdownRef.current = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }

        const seeds = prepareRound();
        const engine = engineRef.current;
        engine.setSeeds(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
        engine.startRound();
        lastTimeRef.current = 0;

        setGameState("running");
        setCurrentMultiplier(1);
        setLastResult(null);
        animFrameRef.current = requestAnimationFrame(gameLoop);
      }
    }, 1000);
  }, [user, betAmount, gameLoop, prepareRound]);

  const handleCashOut = useCallback(() => {
    if (gameState !== "running") return;
    const engine = engineRef.current;
    cancelAnimationFrame(animFrameRef.current);

    const multiplier = engine.currentMultiplier;
    engine.cashOut();
    const payout = Math.floor(betAmount * multiplier);
    const profit = payout - betAmount;

    playGame("Crash", betAmount, payout, `Cashed out at ${multiplier.toFixed(2)}x`);
    setGameState("cashed_out");
    setLastResult({ crashed: false, multiplier, profit });
    setHistory((prev) => [multiplier, ...prev].slice(0, 12));
  }, [gameState, betAmount, playGame]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 400;
      drawCanvas(currentMultiplier, gameState === "crashed");
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [currentMultiplier, gameState, drawCanvas]);

  const chipColor = (mult: number) =>
    mult >= 10
      ? "bg-warning/15 text-warning border border-warning/30"
      : mult >= 2
        ? "bg-success/15 text-success border border-success/30"
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
              label="Bet Amount"
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
              min={1}
              disabled={gameState === "running" || gameState === "countdown"}
              className="font-[family-name:var(--font-mono)] tabular-nums"
            />

            <div className="flex gap-2">
              {QUICK_BETS.map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={gameState === "running" || gameState === "countdown"}
                  className="font-[family-name:var(--font-mono)] tabular-nums"
                >
                  {amount}
                </Button>
              ))}
            </div>

            {gameState === "running" ? (
              <button
                onClick={handleCashOut}
                className="w-full h-12 rounded-[12px] bg-success text-canvas font-semibold text-lg cursor-pointer
                  animate-pulse-glow transition-all duration-150 active:scale-[0.97]
                  hover:shadow-[0_0_30px_rgba(0,245,160,0.4)]"
              >
                Cash Out {currentMultiplier.toFixed(2)}x — {formatCoins(Math.floor(betAmount * currentMultiplier))}
              </button>
            ) : gameState === "countdown" ? (
              <div className="text-center py-3">
                <div className="text-5xl font-black text-gold font-[family-name:var(--font-mono)] tabular-nums animate-pulse">
                  {countdown}
                </div>
                <p className="text-text-secondary text-sm mt-1">Starting...</p>
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={startRound}
                disabled={!user || betAmount <= 0 || betAmount > (user?.balance ?? 0)}
              >
                Place Bet
              </Button>
            )}

            {user && (
              <p className="text-center text-text-secondary text-sm font-[family-name:var(--font-mono)] tabular-nums">
                Balance: {formatCoins(user.balance)}
              </p>
            )}
          </Card>

          {lastResult && (
            <Card
              className={cn(
                "text-center",
                lastResult.crashed
                  ? "border-danger/30 bg-danger/5"
                  : "border-success/30 bg-success/5"
              )}
            >
              <p
                className={cn(
                  "text-lg font-bold font-[family-name:var(--font-mono)] tabular-nums",
                  lastResult.crashed ? "text-danger" : "text-success"
                )}
              >
                {lastResult.crashed
                  ? `Crashed at ${lastResult.multiplier.toFixed(2)}x`
                  : `Cashed out at ${lastResult.multiplier.toFixed(2)}x`}
              </p>
              {!lastResult.crashed && lastResult.profit > 0 && (
                <p className="text-success text-sm mt-1 font-[family-name:var(--font-mono)] tabular-nums">
                  +{formatCoins(lastResult.profit)}
                </p>
              )}
            </Card>
          )}

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
            {history.map((mult, i) => (
              <span
                key={i}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap shrink-0 font-[family-name:var(--font-mono)] animate-chip-in",
                  chipColor(mult)
                )}
              >
                {mult.toFixed(2)}x
              </span>
            ))}
            {history.length === 0 && (
              <span className="text-text-disabled text-xs">No rounds yet</span>
            )}
          </div>

          {/* Canvas */}
          <Card className="relative overflow-hidden p-0">
            <canvas ref={canvasRef} className="w-full rounded-xl" style={{ height: 400 }} />

            {gameState === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-text-disabled text-lg">Place a bet to start</p>
              </div>
            )}

            {gameState === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-7xl font-black text-gold tabular-nums animate-pulse font-[family-name:var(--font-mono)]">
                  {countdown}
                </div>
              </div>
            )}

            {(gameState === "running" || gameState === "crashed" || gameState === "cashed_out") && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className={cn(
                    "text-7xl font-black tabular-nums font-[family-name:var(--font-mono)] drop-shadow-lg transition-colors duration-300",
                    gameState === "crashed"
                      ? "text-danger"
                      : gameState === "cashed_out"
                        ? "text-success"
                        : "text-gold"
                  )}
                >
                  {currentMultiplier.toFixed(2)}x
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
