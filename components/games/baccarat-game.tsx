"use client";

import { useState, useCallback, useRef } from "react";
import { useUserStore } from "@/store/userStore";
import { formatCoins, cn } from "@/lib/utils";
import { generateServerSeed, generateId } from "@/lib/fairness/rng";
import {
  createShoe,
  playRound,
  type Card as BacCard,
  type RoundResult,
} from "@/lib/games/baccarat/logic";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "#FF3366",
  diamonds: "#FF3366",
  clubs: "#FFFFFF",
  spades: "#FFFFFF",
};

type BetType = "player" | "banker" | "tie";
type GamePhase = "betting" | "dealing" | "result";

interface ScoreDot {
  winner: "player" | "banker" | "tie";
}

function BacCardDisplay({ card, index }: { card: BacCard; index: number }) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const rankText =
    card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : String(card.rank);

  return (
    <div
      className="flex h-24 w-16 flex-col items-center justify-between rounded-lg border-2 border-border bg-white p-1.5 animate-in zoom-in-50 fade-in duration-300"
      style={{ color: isRed ? "#FF3366" : "#121420", animationDelay: `${index * 120}ms` }}
    >
      <span className="text-xs font-bold leading-none font-[family-name:var(--font-mono)]">{rankText}</span>
      <span className="text-xl leading-none">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="text-xs font-bold leading-none rotate-180 font-[family-name:var(--font-mono)]">{rankText}</span>
    </div>
  );
}

const QUICK_BETS = [100, 500, 1000, 5000];

export default function BaccaratGame() {
  const user = useUserStore((s) => s.user);
  const playGame = useUserStore((s) => s.playGame);

  const [betAmount, setBetAmount] = useState(100);
  const [betType, setBetType] = useState<BetType>("player");
  const [phase, setPhase] = useState<GamePhase>("betting");
  const [result, setResult] = useState<RoundResult | null>(null);
  const [visibleCards, setVisibleCards] = useState<BacCard[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreDot[]>([]);
  const [roundCount, setRoundCount] = useState(0);
  const [deckCount, setDeckCount] = useState(0);

  const deckRef = useRef<BacCard[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const balance = user?.balance ?? 0;

  const calculatePayout = useCallback(
    (winner: "player" | "banker" | "tie", chosen: BetType, bet: number) => {
      if (winner === "tie") return chosen === "tie" ? bet * 8 : bet;
      if (winner === chosen) {
        if (chosen === "banker") return Math.floor(bet * 0.95) + bet;
        return bet * 2;
      }
      return 0;
    },
    []
  );

  const animateCards = useCallback(async (allCards: BacCard[]) => {
    for (let i = 0; i < allCards.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      setVisibleCards((prev) => [...prev, allCards[i]]);
    }
  }, []);

  const handleDeal = useCallback(async () => {
    if (balance < betAmount) return;

    const serverSeed = generateServerSeed();
    const nonce = Date.now();

    let deck = deckRef.current;
    if (deck.length < 20) {
      deck = createShoe(serverSeed, nonce);
      deckRef.current = deck;
    }

    setRoundCount((c) => c + 1);
    setPhase("dealing");
    setVisibleCards([]);
    setResult(null);

    const roundResult = playRound(deck);
    setDeckCount(deckRef.current.length);
    const allCards = [...roundResult.playerHand.slice(0, 2), ...roundResult.bankerHand.slice(0, 2)];
    if (roundResult.playerHand.length > 2) allCards.push(roundResult.playerHand[2]);
    if (roundResult.bankerHand.length > 2) allCards.push(roundResult.bankerHand[2]);

    await animateCards(allCards);
    await new Promise((r) => setTimeout(r, 300));

    setResult(roundResult);
    setPhase("result");
    setScoreboard((prev) => [{ winner: roundResult.winner }, ...prev].slice(0, 20));

    const payout = calculatePayout(roundResult.winner, betType, betAmount);
    playGame("Baccarat", betAmount, payout);
  }, [balance, betAmount, betType, animateCards, calculatePayout, playGame]);

  const handleNewRound = useCallback(() => {
    setPhase("betting");
    setResult(null);
    setVisibleCards([]);
  }, []);

  const showPlayerCards = phase === "dealing" ? visibleCards.slice(0, 2) : result?.playerHand ?? [];
  const showBankerCards = phase === "dealing" ? visibleCards.slice(2, 4) : result?.bankerHand ?? [];
  const playerScore = result?.playerScore ?? 0;
  const bankerScore = result?.bankerScore ?? 0;

  const isPlayerNatural = result && (result.playerScore >= 8 || result.bankerScore >= 8) && result.playerHand.length === 2;
  const isBankerNatural = result && (result.playerScore >= 8 || result.bankerScore >= 8) && result.bankerHand.length === 2;

  return (
    <div className="flex h-full min-h-[600px] flex-col lg:flex-row">
      <div className="flex w-full flex-col gap-3 p-4 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border">
        {phase === "betting" && (
          <>
            <div className="rounded-xl bg-canvas-elevated p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                Bet Amount
              </p>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
                min={1}
                className="input-field w-full px-3 py-2.5 text-center font-[family-name:var(--font-mono)] text-lg tabular-nums text-text-primary"
              />
              <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                {QUICK_BETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    className="rounded-lg border border-border bg-canvas-card px-2 py-1.5 text-[11px] font-semibold tabular-nums text-text-secondary transition-colors hover:border-gold hover:text-gold"
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-canvas-elevated p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                Bet On
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["player", "banker", "tie"] as BetType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBetType(type)}
                    className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all"
                    style={{
                      background:
                        betType === type
                          ? type === "player"
                            ? "rgba(0,245,160,0.1)"
                            : type === "banker"
                            ? "rgba(255,51,102,0.1)"
                            : "rgba(0,210,255,0.1)"
                          : "#121420",
                      borderColor:
                        betType === type
                          ? type === "player"
                            ? "#00F5A0"
                            : type === "banker"
                            ? "#FF3366"
                            : "#00D2FF"
                          : "#1E2235",
                    }}
                  >
                    <span
                      className="text-sm font-bold"
                      style={{
                        color:
                          betType === type
                            ? type === "player"
                              ? "#00F5A0"
                              : type === "banker"
                              ? "#FF3366"
                              : "#00D2FF"
                            : "#FFFFFF",
                      }}
                    >
                      {type === "player" ? "Player" : type === "banker" ? "Banker" : "Tie"}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {type === "player" ? "1x" : type === "banker" ? "0.95x" : "8x"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDeal}
              disabled={balance < betAmount}
              className="btn-primary w-full py-3.5 text-sm font-bold tracking-wide disabled:opacity-40"
            >
              Deal — {formatCoins(betAmount)}
            </button>
          </>
        )}

        {phase === "dealing" && (
          <div className="rounded-xl bg-canvas-elevated p-4 text-center">
            <p className="text-sm text-text-secondary animate-pulse">Dealing cards...</p>
          </div>
        )}

        {phase === "result" && result && (
          <>
            <div className="rounded-xl bg-canvas-elevated p-4 text-center">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">Result</p>
              <p
                className="text-xl font-bold"
                style={{
                  color:
                    result.winner === "player"
                      ? "#00F5A0"
                      : result.winner === "banker"
                      ? "#FF3366"
                      : "#00D2FF",
                }}
              >
                {result.winner === "tie"
                  ? "Tie Game"
                  : result.winner === "player"
                  ? "Player Wins"
                  : "Banker Wins"}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Bet: {betType.charAt(0).toUpperCase() + betType.slice(1)} · {formatCoins(betAmount)}
              </p>
              <p
                className="mt-1 font-[family-name:var(--font-mono)] text-lg font-bold tabular-nums"
                style={{
                  color:
                    calculatePayout(result.winner, betType, betAmount) >= betAmount ? "#00F5A0" : "#FF3366",
                }}
              >
                {calculatePayout(result.winner, betType, betAmount) >= betAmount
                  ? `+${formatCoins(calculatePayout(result.winner, betType, betAmount) - betAmount)}`
                  : `-${formatCoins(betAmount)}`}
              </p>
            </div>
            <button onClick={handleNewRound} className="btn-primary w-full py-3.5 text-sm font-bold tracking-wide">
              New Round
            </button>
          </>
        )}

        {user && (
          <div className="text-center text-xs text-text-secondary">
            Balance:{" "}
            <span className="font-[family-name:var(--font-mono)] font-semibold tabular-nums text-gold">
              {formatCoins(balance)}
            </span>
          </div>
        )}

        {scoreboard.length > 0 && (
          <div className="rounded-xl bg-canvas-elevated p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Bead Road
            </p>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 20 }).map((_, i) => {
                const dot = scoreboard[i];
                return (
                  <div
                    key={i}
                    className="h-4 w-4 rounded-full transition-all duration-300"
                    style={{
                      background: !dot
                        ? "transparent"
                        : dot.winner === "player"
                        ? "#00F5A0"
                        : dot.winner === "banker"
                        ? "#FF3366"
                        : "#00D2FF",
                      border: !dot ? "1px solid rgba(30,34,53,0.5)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="w-full max-w-2xl rounded-xl bg-canvas-elevated p-6">
          <div className="flex items-start justify-around gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="text-xs font-medium uppercase tracking-widest" style={{ color: "#00F5A0" }}>
                Player
              </div>
              <div className="flex min-h-[6rem] gap-2 justify-center">
                {showPlayerCards.map((card, i) => (
                  <BacCardDisplay key={`p-${i}`} card={card} index={i} />
                ))}
              </div>
              <div
                className={cn(
                  "font-[family-name:var(--font-mono)] text-4xl font-bold tabular-nums",
                  isPlayerNatural && "animate-pulse"
                )}
                style={{ color: isPlayerNatural ? "#00F5A0" : "#FFFFFF" }}
              >
                {playerScore}
              </div>
              {isPlayerNatural && (
                <div className="text-[10px] font-medium tracking-wider text-gold">NATURAL</div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 pt-4">
              <div className="text-xs text-text-secondary">VS</div>
              {result && (
                <div
                  className="rounded-lg px-3 py-1 text-sm font-bold"
                  style={{
                    background:
                      result.winner === "player"
                        ? "rgba(0,245,160,0.1)"
                        : result.winner === "banker"
                        ? "rgba(255,51,102,0.1)"
                        : "rgba(0,210,255,0.1)",
                    color:
                      result.winner === "player"
                        ? "#00F5A0"
                        : result.winner === "banker"
                        ? "#FF3366"
                        : "#00D2FF",
                  }}
                >
                  {result.winner === "tie"
                    ? "TIE"
                    : result.winner === "player"
                    ? "PLAYER"
                    : "BANKER"}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="text-xs font-medium uppercase tracking-widest" style={{ color: "#FF3366" }}>
                Banker
              </div>
              <div className="flex min-h-[6rem] gap-2 justify-center">
                {showBankerCards.map((card, i) => (
                  <BacCardDisplay key={`b-${i}`} card={card} index={i} />
                ))}
              </div>
              <div
                className={cn(
                  "font-[family-name:var(--font-mono)] text-4xl font-bold tabular-nums",
                  isBankerNatural && "animate-pulse"
                )}
                style={{ color: isBankerNatural ? "#FF3366" : "#FFFFFF" }}
              >
                {bankerScore}
              </div>
              {isBankerNatural && (
                <div className="text-[10px] font-medium tracking-wider" style={{ color: "#FF3366" }}>
                  NATURAL
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-text-secondary">
          Shoe:{" "}
          <span className="font-[family-name:var(--font-mono)] tabular-nums text-text-primary">
            {deckCount}
          </span>{" "}
          cards · Round{" "}
          <span className="font-[family-name:var(--font-mono)] tabular-nums text-text-primary">
            {roundCount}
          </span>
        </div>
      </div>
    </div>
  );
}
