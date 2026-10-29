// How counting moves you. Plain state and maths with no three.js, so node can test it.
//
// Two modes:
//   arrive: each round of 33 counts is one approach down the nave. The 33rd count brings you
//           under the dome in front of the mihrab; the next count starts a new approach.
//   ahead:  the qibla wall stays on the horizon. Every count is one more bay, forever.

/** Position within the current round: 0 before the first count, then 1 to `round`. */
export function withinRound(count, round) {
  return count === 0 ? 0 : count - round * Math.floor((count - 1) / round);
}

/** Which phrase the latest count belongs to (0, 1, 2, repeating). 0 before the first count. */
export function phraseIndex(count, round, phrases) {
  return count === 0 ? 0 : Math.floor((count - 1) / round) % phrases;
}

/** In arrive mode, the transverse arcade's z within the current approach. */
export const arriveCut = (motion, hall) => (motion.round - 0.5) * hall.bay;

/** In arrive mode, where the camera rests after `count` counts (z within the approach). */
export function arriveStop(count, motion, hall, qibla) {
  const n = withinRound(count, motion.round);
  if (n === motion.round) return arriveCut(motion, hall) + hall.transverse / 2 - qibla.stopBeforeDome;
  return n * hall.bay;
}

/**
 * One count. Returns the new count and target, and whether the camera must first go back to
 * the start of a new approach (arrive mode, once the previous round has reached the mihrab).
 */
export function step(state, motion, hall, qibla) {
  const count = state.count + 1;
  if (state.mode === 'ahead') return { count, target: state.target + hall.bay, restart: false };
  return {
    count,
    target: arriveStop(count, motion, hall, qibla),
    restart: count > 1 && withinRound(count, motion.round) === 1,
  };
}

/**
 * A critically damped spring, solved exactly for one time step, so it is stable at any frame
 * rate and never overshoots a target it starts still toward. Returns [position, velocity].
 */
export function spring(x, v, target, omega, dt) {
  const delta = x - target;
  const e = Math.exp(-omega * dt);
  const k = (v + omega * delta) * dt;
  return [target + (delta + k) * e, (v - omega * k) * e];
}
