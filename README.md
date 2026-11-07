# Endless Rose

An endless prayer hall for dhikr. Each count carries you one bay down the nave of a T-plan hypostyle,
a forest of columns in the manner of Córdoba and Kairouan, toward the mihrab.

The hall is still plain plaster, with no ornament yet. Its light follows the real day where you are:
the sun comes in through openings in the ceiling where it truly stands, and the hall keeps the
prayer times. Lanterns take over at night.

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
- **Light**: today's prayer times, a slider to preview any hour, your location (saved on your device
  only), and the calculation method. Add `?t=18:10` to the address to open at that hour.

## Check it

```bash
npm test
npm run smoke
```

`npm run smoke` needs the dev server running on port 5197 (`npm run dev -- --port 5197`).

How it works, in plain language: [docs/architecture.md](docs/architecture.md).
