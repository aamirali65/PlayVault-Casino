"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useUserStore } from "@/store/userStore";
import { formatCoins, cn } from "@/lib/utils";
import { AviatorEngine, type BetSlot } from "@/lib/games/aviator/engine";
import { generateServerSeed, hashServerSeed, generateId } from "@/lib/fairness/rng";

const QUICK_BETS = [100, 500, 1000, 5000];

type RoundPhase = "waiting" | "countdown" | "flying" | "flownAway";

interface BetState {
  amount: number;
  autoCashOut: string;
}

interface BetResult {
  cashedOut: boolean;
  multiplier: number;
  profit: number;
  message: string;
}

export default function AviatorGame() {
  const user = useUserStore((s) => s.user);
  const playGame = useUserStore((s) => s.playGame);
  const engineRef = useRef(new AviatorEngine());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<RoundPhase>("waiting");
  const [countdown, setCountdown] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [history, setHistory] = useState<number[]>([]);

  const [bet1, setBet1] = useState<BetState>({ amount: 100, autoCashOut: "" });
  const [bet2, setBet2] = useState<BetState>({ amount: 0, autoCashOut: "" });
  const [bet1Active, setBet1Active] = useState(false);
  const [bet2Active, setBet2Active] = useState(false);
  const [result1, setResult1] = useState<BetResult | null>(null);
  const [result2, setResult2] = useState<BetResult | null>(null);

  const [serverSeed, setServerSeed] = useState(() => generateServerSeed());
  const [clientSeed, setClientSeed] = useState(() => generateId().substring(0, 16));
  const [nonce, setNonce] = useState(0);
  const [prevServerSeedHash, setPrevServerSeedHash] = useState("");

  const drawCanvas = useCallback(
    (multiplier: number, crashed: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, "#090A0F");
      skyGrad.addColorStop(0.3, "#0d1520");
      skyGrad.addColorStop(0.6, "#111d2e");
      skyGrad.addColorStop(1, "#090A0F");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const gy = (h / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const elapsed = engineRef.current.elapsed;
      const maxTime = 10;
      const maxMult = Math.max(multiplier, 2);
      const points: { x: number; y: number }[] = [];
      const steps = Math.min(120, Math.floor(elapsed * 12));

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.min(elapsed, maxTime);
        const m = Math.pow(1.0024, (t * 1000) / 25);
        const x = (t / maxTime) * (w - 80) + 40;
        const y = h - 40 - ((m - 1) / (maxMult - 1)) * (h - 80);
        points.push({ x, y: Math.max(30, y) });
      }

      if (points.length >= 2) {
        const trailColor = crashed ? "rgba(255,51,102," : "rgba(0,245,160,";
        for (let i = 1; i < points.length; i++) {
          const alpha = 0.15 + (i / points.length) * 0.4;
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
          ctx.lineTo(points[i].x, points[i].y);
          ctx.strokeStyle = trailColor + alpha + ")";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
        areaGrad.addColorStop(0, crashed ? "rgba(255,51,102,0.2)" : "rgba(0,245,160,0.2)");
        areaGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.moveTo(points[0].x, h);
        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, h);
        ctx.fillStyle = areaGrad;
        ctx.fill();
      }

      if (points.length > 0) {
        const last = points[points.length - 1];
        ctx.save();
        ctx.translate(last.x, last.y);
        const angle =
          points.length >= 2
            ? Math.atan2(
                last.y - points[points.length - 2].y,
                last.x - points[points.length - 2].x
              )
            : -0.4;
        ctx.rotate(angle);
        ctx.font = "28px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u2708", 0, 0);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = crashed ? "#FF3366" : "#00F5A0";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(last.x, last.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = crashed
          ? "rgba(255,51,102,0.15)"
          : "rgba(0,245,160,0.15)";
        ctx.fill();
      }
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
      setCurrentMultiplier(engine.crashPoint);
      drawCanvas(engine.crashPoint, true);
      setPhase("flownAway");

      if (bet1Active && !engine.bet1.cashedOut) {
        playGame("Aviator", bet1.amount, 0, `Flew away at ${engine.crashPoint.toFixed(2)}x`);
        setResult1({ cashedOut: false, multiplier: 0, profit: 0, message: "Plane flew away!" });
      }
      if (bet2Active && !engine.bet2.cashedOut) {
        playGame("Aviator", bet2.amount, 0, `Flew away at ${engine.crashPoint.toFixed(2)}x`);
        setResult2({ cashedOut: false, multiplier: 0, profit: 0, message: "Plane flew away!" });
      }

      setHistory((prev) => [engine.crashPoint, ...prev].slice(0, 12));
      return;
    }

    if (bet1Active && !engine.bet1.cashedOut && engine.checkAutoCashOut(engine.bet1)) {
      const payout = engine.cashOut(engine.bet1);
      const payoutInt = Math.floor(payout);
      playGame("Aviator", bet1.amount, payoutInt, `Auto cash out at ${engine.bet1.cashOutMultiplier.toFixed(2)}x`);
      setResult1({
        cashedOut: true,
        multiplier: engine.bet1.cashOutMultiplier,
        profit: payoutInt - bet1.amount,
        message: `Cashed out at ${engine.bet1.cashOutMultiplier.toFixed(2)}x`,
      });
    }

    if (bet2Active && !engine.bet2.cashedOut && engine.checkAutoCashOut(engine.bet2)) {
      const payout = engine.cashOut(engine.bet2);
      const payoutInt = Math.floor(payout);
      playGame("Aviator", bet2.amount, payoutInt, `Auto cash out at ${engine.bet2.cashOutMultiplier.toFixed(2)}x`);
      setResult2({
        cashedOut: true,
        multiplier: engine.bet2.cashOutMultiplier,
        profit: payoutInt - bet2.amount,
        message: `Cashed out at ${engine.bet2.cashOutMultiplier.toFixed(2)}x`,
      });
    }

    setCurrentMultiplier(engine.currentMultiplier);
    drawCanvas(engine.currentMultiplier, false);
    animFrameRef.current = requestAnimationFrame(loop);
  }, [bet1Active, bet2Active, bet1.amount, bet2.amount, drawCanvas, playGame]);

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
    if (!user) return;
    const hasBet = (bet1Active && bet1.amount > 0) || (bet2Active && bet2.amount > 0);
    if (!hasBet) return;

    if (bet1Active && bet1.amount > user.balance) return;
    if (bet2Active && bet2.amount > user.balance) return;

    setPhase("countdown");
    setCountdown(3);

    let cd = 3;
    countdownInterval.current = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }

        const seeds = prepareRound();
        const engine = engineRef.current;
        engine.setCrashPoint(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
        engine.startRound();

        if (bet1Active) {
          engine.bet1.amount = bet1.amount;
          engine.bet1.autoCashOut = bet1.autoCashOut ? parseFloat(bet1.autoCashOut) : null;
        }
        if (bet2Active) {
          engine.bet2.amount = bet2.amount;
          engine.bet2.autoCashOut = bet2.autoCashOut ? parseFloat(bet2.autoCashOut) : null;
        }

        lastTimeRef.current = 0;
        setResult1(null);
        setResult2(null);
        setPhase("flying");
        setCurrentMultiplier(1);
        animFrameRef.current = requestAnimationFrame(gameLoop);
      }
    }, 1000);
  }, [user, bet1Active, bet2Active, bet1, bet2, gameLoop, prepareRound]);

  const handleCashOut = useCallback(
    (slot: 1 | 2) => {
      if (phase !== "flying") return;
      const engine = engineRef.current;
      const betSlot = slot === 1 ? engine.bet1 : engine.bet2;
      const betState = slot === 1 ? bet1 : bet2;
      const isActive = slot === 1 ? bet1Active : bet2Active;

      if (!isActive || betSlot.cashedOut) return;

      const payout = engine.cashOut(betSlot);
      const payoutInt = Math.floor(payout);
      playGame("Aviator", betState.amount, payoutInt, `Cashed out at ${betSlot.cashOutMultiplier.toFixed(2)}x`);

      const result: BetResult = {
        cashedOut: true,
        multiplier: betSlot.cashOutMultiplier,
        profit: payoutInt - betState.amount,
        message: `Cashed out at ${betSlot.cashOutMultiplier.toFixed(2)}x — +${formatCoins(payoutInt - betState.amount)}`,
      };

      if (slot === 1) setResult1(result);
      else setResult2(result);
    },
    [phase, bet1, bet2, bet1Active, bet2Active, playGame]
  );

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 400;
      drawCanvas(currentMultiplier, phase === "flownAway");
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [currentMultiplier, phase, drawCanvas]);

  const chipColor = (mult: number) =>
    mult >= 10
      ? "bg-warning/15 text-warning border border-warning/30"
      : mult >= 2
        ? "bg-success/15 text-success border border-success/30"
        : "bg-danger/15 text-danger border border-danger/30";

  const totalBet = (bet1Active ? bet1.amount : 0) + (bet2Active ? bet2.amount : 0);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-2 text-center mb-4">
        <span className="text-gold font-bold text-sm tracking-wider uppercase font-[family-name:var(--font-mono)]">
          Demo Mode
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
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

      <Card className="relative overflow-hidden p-0 mb-4">
        <canvas ref={canvasRef} className="w-full rounded-xl" style={{ height: 400 }} />

        {phase === "waiting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-text-disabled text-lg">Place your bets</p>
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-7xl font-black text-gold tabular-nums animate-pulse font-[family-name:var(--font-mono)]">
                {countdown}
              </span>
            </div>
          </div>
        )}

        {(phase === "flying" || phase === "flownAway") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={cn(
                "text-7xl font-black tabular-nums drop-shadow-lg font-[family-name:var(--font-mono)] transition-colors duration-300",
                phase === "flownAway" ? "text-danger" : "text-gold"
              )}
            >
              {currentMultiplier.toFixed(2)}x
            </span>
          </div>
        )}
      </Card>

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* Left: Bet Controls */}
        <div className="lg:w-[340px] shrink-0 space-y-4">
          {[1, 2].map((slotNum) => {
            const isActive = slotNum === 1 ? bet1Active : bet2Active;
            const betState = slotNum === 1 ? bet1 : bet2;
            const setBet = slotNum === 1 ? setBet1 : setBet2;
            const setActive = slotNum === 1 ? setBet1Active : setBet2Active;
            const result = slotNum === 1 ? result1 : result2;
            const cashedOut = (slotNum === 1 ? result1 : result2)?.cashedOut ?? false;

            return (
              <Card key={slotNum} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">Bet {slotNum}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setActive(e.target.checked)}
                      disabled={phase === "flying" || phase === "countdown"}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span className="text-xs text-text-secondary">Active</span>
                  </label>
                </div>

                {isActive && (
                  <>
                    <Input
                      label="Amount"
                      type="number"
                      value={betState.amount}
                      onChange={(e) =>
                        setBet((p) => ({ ...p, amount: Math.max(0, Number(e.target.value)) }))
                      }
                      min={1}
                      disabled={phase === "flying" || phase === "countdown"}
                      className="font-[family-name:var(--font-mono)] tabular-nums"
                    />

                    <div className="flex gap-1.5">
                      {QUICK_BETS.map((amt) => (
                        <Button
                          key={amt}
                          variant="secondary"
                          size="sm"
                          onClick={() => setBet((p) => ({ ...p, amount: amt }))}
                          disabled={phase === "flying" || phase === "countdown"}
                          className="font-[family-name:var(--font-mono)] tabular-nums"
                        >
                          {amt}
                        </Button>
                      ))}
                    </div>

                    <Input
                      label="Auto Cash Out"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 2.00"
                      value={betState.autoCashOut}
                      onChange={(e) =>
                        setBet((p) => ({ ...p, autoCashOut: e.target.value }))
                      }
                      disabled={phase === "flying" || phase === "countdown"}
                      className="font-[family-name:var(--font-mono)] tabular-nums"
                    />

                    {phase === "flying" && !cashedOut && (
                      <button
                        onClick={() => handleCashOut(slotNum as 1 | 2)}
                        className="w-full h-10 rounded-[12px] bg-success text-canvas font-semibold text-sm cursor-pointer
                          animate-pulse-glow transition-all duration-150 active:scale-[0.97]
                          hover:shadow-[0_0_30px_rgba(0,245,160,0.4)]"
                      >
                        Cash Out {currentMultiplier.toFixed(2)}x
                      </button>
                    )}

                    {phase === "flying" && cashedOut && (
                      <div className="text-center text-success font-bold py-2 font-[family-name:var(--font-mono)]">
                        Cashed Out!
                      </div>
                    )}
                  </>
                )}

                {result && (
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-center text-sm font-bold font-[family-name:var(--font-mono)]",
                      result.cashedOut
                        ? "bg-success/10 text-success border border-success/30"
                        : "bg-danger/10 text-danger border border-danger/30"
                    )}
                  >
                    {result.message}
                    {result.profit > 0 && (
                      <span className="block text-xs mt-0.5">+{formatCoins(result.profit)}</span>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          <Card className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Total Bet</span>
              <span className="font-bold text-text-primary tabular-nums font-[family-name:var(--font-mono)]">{formatCoins(totalBet)}</span>
            </div>

            {phase === "waiting" || phase === "countdown" ? (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={startRound}
                disabled={
                  !user ||
                  (!(bet1Active && bet1.amount > 0) && !(bet2Active && bet2.amount > 0)) ||
                  (bet1Active && bet1.amount > (user?.balance ?? 0)) ||
                  (bet2Active && bet2.amount > (user?.balance ?? 0)) ||
                  phase === "countdown"
                }
              >
                {phase === "countdown" ? `Starting in ${countdown}...` : "Place Bets"}
              </Button>
            ) : (
              <div className="text-center text-text-secondary text-sm py-2">
                {phase === "flying" ? "Round in progress..." : "Round over — place new bets"}
              </div>
            )}

            {user && (
              <p className="text-center text-text-secondary text-sm font-[family-name:var(--font-mono)] tabular-nums">
                Balance: {formatCoins(user.balance)}
              </p>
            )}

            {prevServerSeedHash && (
              <div className="border-t border-border pt-3 mt-2">
                <p className="text-xs text-text-disabled uppercase tracking-wider mb-1">Previous Server Seed</p>
                <p className="text-xs text-text-secondary font-mono break-all">{prevServerSeedHash}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
