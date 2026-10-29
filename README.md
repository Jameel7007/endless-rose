# Endless Rose

An endless prayer hall for dhikr. Each count carries you one bay down the nave of a T-plan hypostyle,
a forest of columns in the manner of Córdoba and Kairouan, toward the mihrab.

This is the **greybox**: plain plaster and no ornament, made for judging the space and the pace before
any tile is laid.

## Run it

```bash
npm install
npm run dev
```

Then open the address Vite prints.

- **Count**: click, tap, or press Space or Enter.
- **Look around**: move the pointer (desktop), swipe (touch), or use the arrow keys.
- **Mihrab: Arrive / Ahead**: either each round of 33 walks you to the mihrab, or the qibla wall stays
  on the horizon.

## Check it

```bash
npm test
npm run smoke
```

`npm run smoke` needs the dev server running on port 5197 (`npm run dev -- --port 5197`).

How it works, in plain language: [docs/architecture.md](docs/architecture.md).
