"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Users, Info, AlertTriangle, Flame, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/userStore";
import { randomBetween } from "@/lib/utils";

interface GameDef {
  slug: string;
  name: string;
  category: string;
  gradient: string;
  icon: string;
  description: string;
  howToPlay: string[];
}

const GAME_MAP: Record<string, GameDef> = {
  crash: { slug: "crash", name: "Crash", category: "crash", gradient: "from-red-500/20 to-orange-500/20", icon: "📈", description: "Watch the multiplier rise and cash out before it crashes.", howToPlay: ["Place your bet before the round starts.", "Watch the multiplier increase in real time.", "Cash out at any time to lock in your winnings.", "If you don't cash out before the crash, you lose your bet."] },
  dice: { slug: "dice", name: "Dice", category: "dice", gradient: "from-blue-500/20 to-purple-500/20", icon: "🎲", description: "Roll the dice and predict the outcome.", howToPlay: ["Choose a target number between 2 and 12.", "Select over or under.", "Place your bet and roll.", "Win if the dice matches your prediction."] },
  roulette: { slug: "roulette", name: "Roulette", category: "cards", gradient: "from-red-600/20 to-yellow-500/20", icon: "🎰", description: "Classic roulette with multiple betting options.", howToPlay: ["Choose your bet type: color, number, or range.", "Place your chips on the table.", "Spin the wheel.", "Win if the ball lands on your selection."] },
  blackjack: { slug: "blackjack", name: "Blackjack", category: "cards", gradient: "from-green-500/20 to-emerald-500/20", icon: "🃏", description: "Beat the dealer to 21 without going over.", howToPlay: ["You and the dealer each get two cards.", "Choose to hit (take another card) or stand.", "Get as close to 21 as possible without going over.", "Beat the dealer's hand to win."] },
  snake: { slug: "snake", name: "Snake", category: "arcade", gradient: "from-lime-500/20 to-green-600/20", icon: "🐍", description: "Classic snake game with a twist.", howToPlay: ["Use arrow keys to control the snake.", "Eat food to grow longer and score points.", "Avoid hitting walls or your own tail.", "The longer you survive, the higher your score."] },
  slots: { slug: "slots", name: "Slots", category: "slots", gradient: "from-cyan-500/20 to-blue-500/20", icon: "🎰", description: "Spin the reels and match symbols.", howToPlay: ["Set your bet amount.", "Spin the reels.", "Match symbols across paylines to win.", "Special symbols trigger bonus features."] },
  mines: { slug: "mines", name: "Mines", category: "dice", gradient: "from-yellow-500/20 to-amber-600/20", icon: "💣", description: "Navigate a minefield and collect gems.", howToPlay: ["Choose how many mines to hide.", "Reveal tiles one by one.", "Each safe tile multiplies your bet.", "Hit a mine and you lose everything."] },
  plinko: { slug: "plinko", name: "Plinko", category: "arcade", gradient: "from-pink-500/20 to-rose-500/20", icon: "📌", description: "Drop the ball and watch it bounce.", howToPlay: ["Choose your risk level.", "Drop a ball from the top of the board.", "Watch it bounce off pegs.", "Collect the multiplier where it lands."] },
  coinflip: { slug: "coinflip", name: "Coin Flip", category: "dice", gradient: "from-amber-500/20 to-yellow-500/20", icon: "🪙", description: "Simple heads or tails with a multiplier.", howToPlay: ["Choose heads or tails.", "Place your bet.", "Flip the coin.", "Double your bet if you guess correctly."] },
  hilo: { slug: "hilo", name: "Hi-Lo", category: "cards", gradient: "from-indigo-500/20 to-violet-500/20", icon: "🃏", description: "Predict if the next card is higher or lower.", howToPlay: ["You're shown a card.", "Predict higher or lower.", "Keep going to build a streak.", "Cash out anytime to collect your winnings."] },
  aviator: { slug: "aviator", name: "Aviator", category: "crash", gradient: "from-purple-500/20 to-pink-500/20", icon: "✈️", description: "Bet and cash out before the plane flies away.", howToPlay: ["Place your bet before takeoff.", "Watch the plane ascend and the multiplier grow.", "Cash out at any time.", "If the plane flies away before you cash out, you lose."] },
  teenpatti: { slug: "teenpatti", name: "Teen Patti", category: "cards", gradient: "from-orange-500/20 to-red-500/20", icon: "🃏", description: "Three-card poker variant popular in South Asia.", howToPlay: ["You receive three cards.", "Choose to play blind or seen.", "Bet against other players.", "Best three-card hand wins."] },
  andarbahar: { slug: "andarbahar", name: "Andar Bahar", category: "cards", gradient: "from-teal-500/20 to-cyan-500/20", icon: "🎯", description: "Classic Indian card game of chance.", howToPlay: ["A middle card is placed face up.", "Bet on Andar (inside) or Bahar (outside).", "Cards are dealt to both sides.", "The side that gets the matching card first wins."] },
  baccarat: { slug: "baccarat", name: "Baccarat", category: "cards", gradient: "from-emerald-500/20 to-teal-500/20", icon: "🃏", description: "Elegant card game of banker vs player.", howToPlay: ["Bet on Player, Banker, or Tie.", "Two hands of two cards are dealt.", "Hand closest to 9 wins.", "Face cards and tens are worth zero."] },
  limbo: { slug: "limbo", name: "Limbo", category: "crash", gradient: "from-violet-500/20 to-indigo-500/20", icon: "🚀", description: "Set your target multiplier and test your luck.", howToPlay: ["Choose your target multiplier.", "Place your bet.", "The game generates a random result.", "Win if the result meets or exceeds your target."] },
};

const GAME_COMPONENTS: Record<string, React.ComponentType> = {
  crash: dynamic(() => import("@/components/games/crash-game"), { ssr: false, loading: () => <LoadingGame /> }),
  dice: dynamic(() => import("@/components/games/dice-game"), { ssr: false, loading: () => <LoadingGame /> }),
  roulette: dynamic(() => import("@/components/games/roulette-game"), { ssr: false, loading: () => <LoadingGame /> }),
  blackjack: dynamic(() => import("@/components/games/blackjack-game"), { ssr: false, loading: () => <LoadingGame /> }),
  snake: dynamic(() => import("@/components/games/snake-game"), { ssr: false, loading: () => <LoadingGame /> }),
  slots: dynamic(() => import("@/components/games/slots-game"), { ssr: false, loading: () => <LoadingGame /> }),
  mines: dynamic(() => import("@/components/games/mines-game"), { ssr: false, loading: () => <LoadingGame /> }),
  plinko: dynamic(() => import("@/components/games/plinko-game"), { ssr: false, loading: () => <LoadingGame /> }),
  coinflip: dynamic(() => import("@/components/games/coinflip-game"), { ssr: false, loading: () => <LoadingGame /> }),
  hilo: dynamic(() => import("@/components/games/hilo-game"), { ssr: false, loading: () => <LoadingGame /> }),
  aviator: dynamic(() => import("@/components/games/aviator-game"), { ssr: false, loading: () => <LoadingGame /> }),
  teenpatti: dynamic(() => import("@/components/games/teenpatti-game"), { ssr: false, loading: () => <LoadingGame /> }),
  andarbahar: dynamic(() => import("@/components/games/andar-bahar-game"), { ssr: false, loading: () => <LoadingGame /> }),
  baccarat: dynamic(() => import("@/components/games/baccarat-game"), { ssr: false, loading: () => <LoadingGame /> }),
  limbo: dynamic(() => import("@/components/games/limbo-game"), { ssr: false, loading: () => <LoadingGame /> }),
};

function LoadingGame() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        <p className="text-sm font-display text-text-muted tracking-wide uppercase">Loading game...</p>
      </div>
    </div>
  );
}

export default function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const user = useUserStore((s) => s.user);
  const [playerCount, setPlayerCount] = useState(() => randomBetween(100, 5000));
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const game = GAME_MAP[slug];
  const GameComponent = GAME_COMPONENTS[slug];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlayerCount((prev) => Math.max(50, prev + randomBetween(-20, 20)));
    }, 5000);
    return () => clearInterval(interval);
  }, [slug]);

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center p-8 max-w-md rounded-2xl bg-canvas-card border border-border">
          <span className="text-6xl mb-4 block">😕</span>
          <h1 className="font-display text-2xl font-bold mb-2">Game Not Found</h1>
          <p className="text-text-muted mb-6">
            The game &quot;{slug}&quot; doesn&apos;t exist or has been removed.
          </p>
          <Link href="/games">
            <Button>Browse All Games</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      {/* Back Navigation */}
      <Link href="/games" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-gold transition-colors mb-6 group">
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-sm font-medium">All Games</span>
      </Link>

      {/* Game Title Area */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-canvas-card border border-border text-4xl shrink-0">
            {game.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{game.name}</h1>
              {playerCount > 2000 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange/10 border border-orange/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-orange">
                  <Flame className="h-3 w-3" />
                  Hot
                </span>
              )}
              {playerCount > 3000 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple/10 border border-purple/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple">
                  <TrendingUp className="h-3 w-3" />
                  Popular
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="inline-flex items-center rounded-full bg-surface border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                {game.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
                </span>
                <Users className="h-3 w-3" />
                {playerCount.toLocaleString()} playing
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      <div className="mb-5 rounded-[12px] border border-gold/20 bg-gold/5 px-4 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
          <AlertTriangle className="h-4 w-4 text-gold" />
        </div>
        <span className="text-sm font-medium text-gold">DEMO MODE — Play with virtual Demo Coins. No real money involved.</span>
      </div>

      {/* Game Container */}
      <div className="mb-8 rounded-[16px] border border-border overflow-hidden bg-canvas-card">
        {GameComponent ? <GameComponent /> : <LoadingGame />}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
        <div className="md:col-span-2 hud-panel p-5">
          <h3 className="font-display text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">About</h3>
          <p className="text-sm text-text-muted leading-relaxed">{game.description}</p>
        </div>
        <div className="hud-panel p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-cyan" />
            <span className="text-sm font-display font-semibold text-text-secondary uppercase tracking-wider">Live Players</span>
          </div>
          <p className="text-3xl font-display font-bold text-gold text-glow-gold">{playerCount.toLocaleString()}</p>
        </div>
      </div>

      {/* How to Play Section */}
      <div className="hud-panel p-5 mb-6">
        <button
          onClick={() => setShowHowToPlay(!showHowToPlay)}
          className="flex w-full items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
              <Info className="h-4 w-4 text-gold" />
            </div>
            <span className="font-display font-semibold text-text-primary">How to Play</span>
          </div>
          <span className="text-text-muted text-sm transition-transform duration-200 group-hover:text-gold" style={{ transform: showHowToPlay ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>
        {showHowToPlay && (
          <div className="mt-5 space-y-3">
            {game.howToPlay.map((step, i) => (
              <div key={i} className="flex items-start gap-3.5 rounded-xl bg-surface/50 border border-border p-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-display font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
