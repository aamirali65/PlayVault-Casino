# PlayVault Casino

**A modern, demo-only casino game platform built with Next.js, React and TypeScript.**

PlayVault Casino is a full-featured front-end gaming product: 15 instant-play titles, a persistent
virtual wallet, tournaments, leaderboards, live feeds, progression systems and a complete admin
console — all rendered with a dark, HUD-inspired design system. Every round runs on a client-side
**provably-fair** RNG, and all balances are **virtual Demo Coins**: there is no real-money gambling
anywhere in the product.

---

## Highlights

- **15 playable games** — Crash, Aviator, Limbo, Dice, Plinko, Mines, Coin Flip, Slots, Snake,
  Blackjack, Baccarat, Roulette, Hi-Lo, Teen Patti and Andar Bahar.
- **Provably-fair outcomes** — HMAC-SHA256 server/client seed + nonce scheme with a published
  server-seed hash, a configurable 1% demo house edge and per-game result verification.
- **Player economy** — virtual wallet, bet history, XP/level progression, achievements, daily
  reward streaks, promotions and a demo balance reset.
- **Competitive layer** — tournaments, global leaderboard, live activity feed, notifications.
- **Admin console** — user management, game catalogue, tournaments, rewards, analytics dashboards
  (Recharts) and platform settings.
- **Responsible by design** — explicit *Responsible Play* page, demo-mode badge and zero real-money
  flows.
- **Production-grade UX** — responsive desktop/mobile navigation, command-style search modal,
  toasts, modals and framer-motion transitions on top of a tokenised Tailwind v4 theme.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| UI | React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, custom design tokens, Google Fonts (Bungee / Exo 2 / Space Grotesk) |
| State | Zustand (user, wallet, game stores) |
| Forms & validation | React Hook Form + Zod |
| Animation & charts | Framer Motion, Recharts, Lucide icons |
| Persistence | Browser `localStorage` (auth, wallet, rewards, achievements) — no backend required |

## Getting started

```bash
git clone https://github.com/aamirali65/PlayVault-Casino.git
cd PlayVault-Casino
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and play as a guest, or register a local demo
account.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint (0 errors) |

## Project structure

```
app/                  # App Router routes
  admin/              # Admin console (users, games, tournaments, rewards, analytics, settings)
  games/[slug]/       # Dynamic game shell with lazy-loaded game modules
  leaderboard|live|tournaments|promotions|rewards|profile|...
components/
  games/              # One self-contained UI per title (canvas, cards, board, etc.)
  layout/ navigation/ ui/   # Shell, nav, and design-system primitives
lib/
  fairness/           # HMAC-SHA256 provably-fair RNG + seed utilities
  games/              # Deterministic game engines (pure logic, unit-testable)
  auth/ wallet/ storage/ utils/
store/                # Zustand stores (user session, wallet, game state)
types/                # Shared domain models
```

Game engines are deliberately separated from their React components: `lib/games/*` contains pure
deterministic logic, while `components/games/*` owns rendering, animation and input.

## Fairness model

1. A server seed is generated per round and its hash is published **before** the round starts.
2. The outcome is `HMAC-SHA256(serverSeed, clientSeed:nonce)` mapped to a float in `[0, 1)`.
3. After the round, the server seed is revealed so the result can be independently re-computed.

Because this is a demo build, seeds and balances live client-side; the same scheme maps 1:1 onto a
real server-authoritative implementation.

## Responsible use

PlayVault Casino is an educational/demo product. Coins have no monetary value, cannot be purchased
or withdrawn, and no real-money wagering takes place. Play responsibly and never spend more than
you can afford to lose.

## License

All rights reserved. Contact the author for licensing terms.
