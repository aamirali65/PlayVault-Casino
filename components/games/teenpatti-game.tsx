"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUserStore } from "@/store/userStore";
import { formatCoins, cn, randomBetween } from "@/lib/utils";
import { generateServerSeed, generateId } from "@/lib/fairness/rng";
import {
  Card,
  HandType,
  evaluateHand,
  compareHands,
  dealCards,
  botDecision,
  suitSymbol,
  rankName,
} from "@/lib/games/teenpatti/logic";

const BOOT_AMOUNT = 100;
const QUICK_BETS = [100, 500, 1000];

const HAND_LABELS: Record<HandType, string> = {
  [HandType.TRAIL]: "Trail",
  [HandType.PURE_SEQUENCE]: "Pure Seq",
  [HandType.SEQUENCE]: "Sequence",
  [HandType.COLOR]: "Color",
  [HandType.PAIR]: "Pair",
  [HandType.HIGH_CARD]: "High Card",
};

type GameState = "idle" | "betting" | "playing" | "reveal" | "result";

interface Player {
  id: number;
  name: string;
  cards: Card[];
  isBot: boolean;
  folded: boolean;
  isSeen: boolean;
  totalBet: number;
  evaluation?: ReturnType<typeof evaluateHand>;
}

function TPCardDisplay({
  card,
  faceDown,
  flipped,
  small,
}: {
  card?: Card;
  faceDown?: boolean;
  flipped?: boolean;
  small?: boolean;
}) {
  if (faceDown) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg select-none",
          small ? "h-14 w-10 text-xs" : "h-20 w-14 text-sm"
        )}
        style={{
          background: "linear-gradient(135deg, #121420, #1A1D30)",
          border: "1px solid #1E2235",
        }}
      >
        <span className="font-bold opacity-30" style={{ color: "#474D66" }}>?</span>
      </div>
    );
  }
  if (!card) return null;

  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg select-none border-2 border-border bg-white transition-all duration-500",
        small ? "h-14 w-10 text-xs" : "h-20 w-14 text-sm",
        flipped && "animate-[flipCard_0.5s_ease-out]"
      )}
    >
      <span className={cn("text-lg leading-none", isRed ? "text-[#FF3366]" : "text-[#121420]")}>
        {suitSymbol(card.suit)}
      </span>
      <span
        className={cn(
          "font-bold font-[family-name:var(--font-mono)]",
          isRed ? "text-[#FF3366]" : "text-[#121420]",
          small ? "text-[10px]" : "text-xs"
        )}
      >
        {rankName(card.rank)}
      </span>
    </div>
  );
}

function PlayerSeat({
  player,
  isActive,
  showCards,
  position,
}: {
  player: Player;
  isActive: boolean;
  showCards: boolean;
  position: string;
}) {
  const posClasses: Record<string, string> = {
    top: "items-center",
    "top-left": "items-start",
    "top-right": "items-end",
    "bottom-left": "items-start",
    "bottom-right": "items-end",
    bottom: "items-center",
  };

  return (
    <div className={cn("flex flex-col gap-1", posClasses[position])}>
      <div className="flex gap-1">
        {player.cards.map((card, i) => (
          <TPCardDisplay
            key={i}
            card={showCards ? card : undefined}
            faceDown={!showCards}
            flipped={showCards}
            small
          />
        ))}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: isActive ? "#00F5A0" : "#1E2235",
            color: isActive ? "#090A0F" : "#8F95B2",
            opacity: player.folded ? 0.4 : 1,
          }}
        >
          {player.isBot ? "🤖" : "👤"}
        </div>
        <span
          className="text-[11px] font-medium"
          style={{
            color: player.folded ? "#474D66" : "#FFFFFF",
            textDecoration: player.folded ? "line-through" : "none",
          }}
        >
          {player.name}
        </span>
        {showCards && !player.folded && player.evaluation && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{ background: "rgba(0,245,160,0.15)", color: "#00F5A0" }}
          >
            {HAND_LABELS[player.evaluation.type]}
          </span>
        )}
        {!player.folded && player.totalBet > 0 && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-text-secondary">
            {formatCoins(player.totalBet)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TeenPattiGame() {
  const { user, playGame: storePlayGame } = useUserStore();
  const [gameState, setGameState] = useState<GameState>("idle");
  const [players, setPlayers] = useState<Player[]>([]);
  const [pot, setPot] = useState(0);
  const [betAmount, setBetAmount] = useState(BOOT_AMOUNT);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [message, setMessage] = useState("");
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [playerIsSeen, setPlayerIsSeen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const serverSeedRef = useRef("");
  const nonceRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botActionRef = useRef<(players: Player[], botIdx: number, pot: number) => void>(
    () => {}
  );

  const BOT_NAMES = ["Arjun", "Priya", "Ravi", "Meera", "Vikram"];
  const balance = user?.balance ?? 0;

  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const startRound = useCallback(() => {
    cleanup();
    const serverSeed = generateServerSeed();
    const nonce = Date.now();
    serverSeedRef.current = serverSeed;
    nonceRef.current = nonce;

    const hands = dealCards(6, serverSeed, nonce);
    const newPlayers: Player[] = hands.map((hand, i) => ({
      id: i,
      name: i === 0 ? "You" : BOT_NAMES[i - 1],
      cards: hand,
      isBot: i !== 0,
      folded: false,
      isSeen: i !== 0 ? Math.random() > 0.5 : false,
      totalBet: BOOT_AMOUNT,
    }));

    setPlayers(newPlayers);
    setPot(BOOT_AMOUNT * 6);
    setCurrentPlayerIdx(0);
    setGameState("betting");
    setMessage("Your turn — place a bet or go blind");
    setPlayerIsSeen(false);
  }, [cleanup]);

  const advanceTurn = useCallback(
    (currentPlayers: Player[], currentPot: number) => {
      const active = currentPlayers.filter((p) => !p.folded);

      if (active.length === 1) {
        const winner = active[0];
        setGameState("reveal");
        setMessage(`${winner.name} wins ${formatCoins(currentPot)}!`);

        if (!winner.isBot) {
          setWins((w) => w + 1);
          storePlayGame("Teen Patti", currentPlayers[0].totalBet, currentPot, "Won by default");
        } else {
          setLosses((l) => l + 1);
          storePlayGame("Teen Patti", currentPlayers[0].totalBet, 0, "Lost - all folded");
        }

        timeoutRef.current = setTimeout(() => setGameState("result"), 2000);
        return;
      }

      let nextIdx = (currentPlayers.indexOf(active[0]!) + 1) % currentPlayers.length;
      let count = 0;
      while (currentPlayers[nextIdx].folded && count < currentPlayers.length) {
        nextIdx = (nextIdx + 1) % currentPlayers.length;
        count++;
      }

      if (currentPlayers[nextIdx].isBot) {
        setCurrentPlayerIdx(nextIdx);
        botActionRef.current(currentPlayers, nextIdx, currentPot);
      } else {
        setCurrentPlayerIdx(nextIdx);
        setGameState("playing");
        setMessage("Your turn");
      }
    },
    [storePlayGame]
  );

  const botAction = useCallback(
    (currentPlayers: Player[], botIdx: number, currentPot: number) => {
      timeoutRef.current = setTimeout(() => {
        const bot = { ...currentPlayers[botIdx] };
        nonceRef.current += 1;

        const action = botDecision(
          bot.cards,
          currentPot,
          betAmount,
          serverSeedRef.current,
          nonceRef.current
        );

        const activeCount = currentPlayers.filter((p) => !p.folded).length;

        if (action === "pack") {
          bot.folded = true;
          setMessage(`${bot.name} folded`);
        } else if (action === "show" && activeCount === 2) {
          const other = currentPlayers.find((p, i) => i !== botIdx && !p.folded)!;
          const botEval = evaluateHand(bot.cards);
          const otherEval = evaluateHand(other.cards);
          const res = compareHands(botEval, otherEval);

          if (res >= 0) {
            setMessage(`${bot.name} asked for a SHOW!`);
            const updated = currentPlayers.map((p, i) =>
              i === botIdx
                ? { ...p, evaluation: botEval }
                : i === other.id
                ? { ...p, evaluation: otherEval }
                : p
            );
            setPlayers(updated);
            setGameState("reveal");

            if (res > 0) {
              setLosses((l) => l + 1);
              storePlayGame("Teen Patti", currentPlayers[0].totalBet, 0, `Lost to ${bot.name} in show`);
            } else {
              setMessage("Split pot — tie!");
              storePlayGame("Teen Patti", currentPlayers[0].totalBet, currentPot / 2, "Tie in show");
            }

            timeoutRef.current = setTimeout(() => setGameState("result"), 2000);
            return;
          } else {
            bot.folded = true;
            setMessage(`${bot.name} folded on show attempt`);
          }
        } else {
          const callAmt = bot.isSeen ? betAmount * 2 : betAmount;
          bot.totalBet += callAmt;
          setMessage(`${bot.name} called ${formatCoins(callAmt)}`);
        }

        const updated = currentPlayers.map((p, i) => (i === botIdx ? bot : p));
        const newPot = updated.reduce((s, p) => s + p.totalBet, 0);
        setPlayers(updated);
        setPot(newPot);
        advanceTurn(updated, newPot);
      }, randomBetween(800, 1800));
    },
    [betAmount, advanceTurn, storePlayGame]
  );

  useEffect(() => {
    botActionRef.current = botAction;
  }, [botAction]);

  const handleCall = useCallback(() => {
    if (gameState !== "playing") return;
    const amount = playerIsSeen ? betAmount * 2 : betAmount;
    if (balance < amount) {
      setMessage("Not enough balance!");
      return;
    }

    const updated = [...players];
    updated[0] = { ...updated[0], totalBet: updated[0].totalBet + amount };
    const newPot = updated.reduce((s, p) => s + p.totalBet, 0);
    setPlayers(updated);
    setPot(newPot);
    setMessage(`You called ${formatCoins(amount)}`);

    if (updated[0].totalBet >= 2000 && !playerIsSeen) {
      setMessage("Maximum blind reached — must go seen");
      setPlayerIsSeen(true);
    }

    advanceTurn(updated, newPot);
  }, [gameState, players, betAmount, playerIsSeen, balance, advanceTurn]);

  const handleFold = useCallback(() => {
    if (gameState !== "playing") return;
    const updated = [...players];
    updated[0] = { ...updated[0], folded: true };
    const newPot = updated.reduce((s, p) => s + p.totalBet, 0);
    setPlayers(updated);
    setPot(newPot);
    setLosses((l) => l + 1);
    setMessage("You folded!");
    storePlayGame("Teen Patti", players[0].totalBet, 0, "Folded");
    advanceTurn(updated, newPot);
  }, [gameState, players, storePlayGame, advanceTurn]);

  const handleShow = useCallback(() => {
    if (gameState !== "playing") return;
    const active = players.filter((p) => !p.folded);
    if (active.length !== 2) return;

    const playerEval = evaluateHand(players[0].cards);
    const other = active.find((p) => p.isBot)!;
    const otherEval = evaluateHand(other.cards);

    const updated = players.map((p) => {
      if (p.id === 0) return { ...p, evaluation: playerEval };
      if (p.id === other.id) return { ...p, evaluation: otherEval };
      return p;
    });

    setPlayers(updated);
    setGameState("reveal");

    const res = compareHands(playerEval, otherEval);
    const totalPot = updated.reduce((s, p) => s + p.totalBet, 0);

    if (res > 0) {
      setMessage(`You win ${formatCoins(totalPot)}!`);
      setWins((w) => w + 1);
      storePlayGame("Teen Patti", players[0].totalBet, totalPot, `Won against ${other.name}`);
    } else if (res < 0) {
      setMessage(`${other.name} wins!`);
      setLosses((l) => l + 1);
      storePlayGame("Teen Patti", players[0].totalBet, 0, `Lost to ${other.name}`);
    } else {
      setMessage("Split pot — tie!");
      storePlayGame("Teen Patti", players[0].totalBet, totalPot / 2, "Tie");
    }

    timeoutRef.current = setTimeout(() => setGameState("result"), 2500);
  }, [gameState, players, storePlayGame]);

  const handleBlind = useCallback(() => {
    if (gameState !== "betting") return;
    setPlayerIsSeen(false);
    setGameState("playing");
    setMessage("Playing BLIND — call/fold/show");
  }, [gameState]);

  const handleSeen = useCallback(() => {
    if (gameState !== "betting") return;
    setPlayerIsSeen(true);
    const updated = [...players];
    updated[0] = { ...updated[0], isSeen: true };
    setPlayers(updated);
    setGameState("playing");
    setMessage("Playing SEEN — double stakes!");
  }, [gameState, players]);

  const activePlayers = players.filter((p) => !p.folded);

  return (
    <div className="relative flex min-h-[600px] flex-col" style={{ background: "#090A0F" }}>
      <div className="flex items-center justify-between p-4">
        <h2 className="text-xl font-bold text-text-gold">Teen Patti</h2>
        <div className="flex items-center gap-4">
          <div className="text-xs text-text-secondary">
            W:{" "}
            <span className="font-medium font-[family-name:var(--font-mono)] tabular-nums text-success">{wins}</span>{" "}
            / L:{" "}
            <span className="font-medium font-[family-name:var(--font-mono)] tabular-nums text-danger">{losses}</span>
          </div>
          <div className="text-sm text-text-secondary">
            Balance:{" "}
            <span className="font-[family-name:var(--font-mono)] font-semibold tabular-nums text-gold">
              {formatCoins(balance)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="relative w-full max-w-2xl aspect-[16/10]">
          <div
            className="absolute inset-4 rounded-[40%]"
            style={{
              background: "linear-gradient(180deg, #090A0F, #121420)",
              border: "4px solid #1E2235",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
            }}
          />

          <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2">
            {players.length > 1 && (
              <PlayerSeat player={players[1]} isActive={currentPlayerIdx === 1} showCards={gameState === "reveal"} position="top" />
            )}
          </div>

          <div className="absolute left-0 top-12 z-10">
            {players.length > 2 && (
              <PlayerSeat player={players[2]} isActive={currentPlayerIdx === 2} showCards={gameState === "reveal"} position="top-left" />
            )}
          </div>

          <div className="absolute right-0 top-12 z-10">
            {players.length > 3 && (
              <PlayerSeat player={players[3]} isActive={currentPlayerIdx === 3} showCards={gameState === "reveal"} position="top-right" />
            )}
          </div>

          <div className="absolute bottom-20 left-0 z-10">
            {players.length > 4 && (
              <PlayerSeat player={players[4]} isActive={currentPlayerIdx === 4} showCards={gameState === "reveal"} position="bottom-left" />
            )}
          </div>

          <div className="absolute bottom-20 right-0 z-10">
            {players.length > 5 && (
              <PlayerSeat player={players[5]} isActive={currentPlayerIdx === 5} showCards={gameState === "reveal"} position="bottom-right" />
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
            <div
              className="pointer-events-auto rounded-xl px-5 py-2.5 text-center backdrop-blur-sm"
              style={{ background: "rgba(9,10,15,0.85)", border: "1px solid #1E2235" }}
            >
              <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-secondary">Pot</div>
              <div className="font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-gold">
                {formatCoins(pot)}
              </div>
              {message && (
                <div className="mt-1 max-w-48 text-xs text-text-secondary">{message}</div>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2">
            {players.length > 0 && (
              <PlayerSeat player={players[0]} isActive={currentPlayerIdx === 0} showCards={true} position="bottom" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 pb-4">
        {gameState === "idle" && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => {
                if (balance < BOOT_AMOUNT * 6) {
                  setMessage("Not enough balance!");
                  return;
                }
                startRound();
              }}
              className="btn-primary px-8 py-3 text-lg font-bold"
            >
              Start Round
            </button>
            <div className="text-xs text-text-secondary">Boot: {formatCoins(BOOT_AMOUNT)} per player</div>

            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-[11px] text-gold/70 transition-colors hover:text-gold"
            >
              {showHelp ? "Hide" : "How to Play"}
            </button>

            {showHelp && (
              <div className="w-full max-w-md rounded-xl bg-canvas-card p-4 text-left border border-border">
                <div className="space-y-2 text-xs text-text-secondary">
                  <p><span className="font-semibold text-gold">Blind:</span> Bet without seeing cards. Half stake. Max 2000 blind bet.</p>
                  <p><span className="font-semibold text-gold">Seen:</span> View cards first. Double stakes.</p>
                  <p><span className="font-semibold text-gold">Chaal:</span> Call the current bet to stay in.</p>
                  <p><span className="font-semibold text-gold">Pack:</span> Fold and lose your bets.</p>
                  <p><span className="font-semibold text-gold">Show:</span> When 2 players remain, compare cards.</p>
                  <div className="pt-2" style={{ borderTop: "1px solid #1E2235" }}>
                    <p className="mb-1 font-medium text-text-gold">Hand Rankings (high → low):</p>
                    <p>Trail → Pure Seq → Seq → Color → Pair → High Card</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === "betting" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">Bet:</span>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(100, Number(e.target.value)))}
                  className="input-field w-24 px-3 py-1.5 text-center font-[family-name:var(--font-mono)] text-sm tabular-nums text-text-gold"
                />
              </div>
              <div className="flex gap-1">
                {QUICK_BETS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBetAmount(q)}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: betAmount === q ? "#00F5A0" : "#121420",
                      border: `1px solid ${betAmount === q ? "#00F5A0" : "#1E2235"}`,
                      color: betAmount === q ? "#090A0F" : "#8F95B2",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleBlind} className="btn-secondary px-4 py-2 text-xs font-bold">
                Blind
              </button>
              <button onClick={handleSeen} className="btn-secondary px-4 py-2 text-xs font-bold">
                Seen
              </button>
            </div>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">Bet:</span>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(100, Number(e.target.value)))}
                  className="input-field w-24 px-3 py-1.5 text-center font-[family-name:var(--font-mono)] text-sm tabular-nums text-text-gold"
                />
              </div>
              <div className="flex gap-1">
                {QUICK_BETS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBetAmount(q)}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: betAmount === q ? "#00F5A0" : "#121420",
                      border: `1px solid ${betAmount === q ? "#00F5A0" : "#1E2235"}`,
                      color: betAmount === q ? "#090A0F" : "#8F95B2",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCall} className="btn-primary px-4 py-2 text-xs font-bold">
                Chaal ({formatCoins(playerIsSeen ? betAmount * 2 : betAmount)})
              </button>
              <button
                onClick={handleFold}
                className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
              >
                Pack
              </button>
              {activePlayers.length === 2 && (
                <button onClick={handleShow} className="btn-secondary px-4 py-2 text-xs font-bold">
                  Show
                </button>
              )}
            </div>
          </div>
        )}

        {(gameState === "reveal" || gameState === "result") && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-lg font-bold text-gold">{message}</div>
            {gameState === "result" && (
              <button onClick={startRound} className="btn-primary px-6 py-2 text-sm font-bold">
                Play Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
