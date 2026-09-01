# Fantasy Draft Coach

Live fantasy football draft assistant for 2026. Rebuild of the classic Draft Prep workflow: configure a league, track every pick, and get **Probabilistic Drafting Ratings (PDR)** that look up to 12 rounds ahead instead of blindly taking the highest VOR.

## Features

- League setup for 4–16 teams, snake / linear / custom order, redraft or keepers
- Standard, half-PPR, PPR, and custom scoring
- Configurable roster (starters, two flex slots, bench)
- Live PDR recommendations with tiers, VOR, ADP, and “will he last?” odds
- Searchable player pool with 2026 ADP, projections, RB handcuffs, and highlights
- Mock to your pick or auto-complete the room, then grade every team

## Open the app

There is no live site on the GitHub repo page itself. After you turn on Pages once
(`Settings → Pages → Deploy from branch → gh-pages → /`), the app is at:

**https://joeyskrong.github.io/fantasy-draft-coach/**

Until then, run it locally:

```bash
git clone https://github.com/joeyskrong/fantasy-draft-coach.git
cd fantasy-draft-coach
git checkout cursor/rebuild-fantasy-draft-coach-41ba
git pull origin cursor/rebuild-fantasy-draft-coach-41ba
npm install
npm run dev
```

Open **http://localhost:5173**, then **Start draft setup**. Team 1 keepers include David Montgomery in **round 5**.

If an old tab is still open, stop the old `npm run dev` (Ctrl+C), pull, start it again, and hard-refresh the browser (Cmd+Shift+R).

```bash
npm test
npm run build
npm run preview
```

## How PDR works

1. Convert each player’s ADP and ADP standard deviation into the probability they are still available at a given pick (normal CDF).
2. For each position at each of your remaining picks, compute the expected value of the best available player.
3. Search remaining roster needs (starters, then flex, then bench) across those future picks.
4. Recommend the player who best fits the first step of that plan, adjusted for VOR, reach, and survival to your next pick.

VBD (value over replacement) is still shown so you can fade the model when you want.

Player ADP is sourced from August 2026 public mock-draft data (Fantasy Football Calculator / consensus). Counting stats are generated from positional ADP so scoring changes re-score the pool. Edit any player in the draft room if you disagree.
