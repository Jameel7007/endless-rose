// Keeps the hall smooth on slower devices by drawing fewer pixels. Frames are timed over windows
// of 1.5 s: while they run slow, the pixel ratio steps down; after a long stretch of smooth
// frames, it steps back up. A step down that brings no real speed-up is undone and not tried
// again: then something else is setting the pace (an iPhone in Low Power Mode holds 30 fps
// whatever we draw). Plain logic, so node can test it; `apply` sets the ratio.

const WINDOW = 1.5;     // seconds per measurement
const SLOW = 1 / 48;    // average frame time that counts as slow
const SMOOTH = 1 / 57;  // and as smooth (60 Hz screens can't show more)
const PATIENCE = 4;     // smooth windows in a row before stepping back up
const COOLDOWN = 60;    // seconds before stepping up to a level that was too slow

export class Quality {
  constructor(maxRatio, apply) {
    const steps = [1, 0.8, 0.65, 0.5].map(f => Math.max(1, Math.round(maxRatio * f * 100) / 100));
    this.ratios = [...new Set(steps)];
    this.apply = apply;
    this.level = 0;
    this.time = 0;
    this.frames = 0;
    this.clock = 0;
    this.smooth = 0;
    this.trial = null;      // a step down being judged: { from, before }
    this.floor = false;     // set once stepping down stopped helping
    this.tooSlow = {};      // level → when it was last too slow
    apply(this.ratios[0]);
  }

  get ratio() {
    return this.ratios[this.level];
  }

  set(level) {
    this.level = level;
    this.apply(this.ratios[level]);
  }

  /** Call once a frame with its length in seconds. */
  frame(dt) {
    if (dt > 0.25) return; // a paused tab or a hitch, not the steady pace
    this.clock += dt;
    this.time += dt;
    this.frames++;
    if (this.time < WINDOW) return;
    const avg = this.time / this.frames;
    this.time = 0;
    this.frames = 0;
    if (this.trial) {
      if (avg > this.trial.before * 0.9) {
        this.set(this.trial.from); // no real gain: the pace is set elsewhere
        this.floor = true;
      }
      this.trial = null;
      return;
    }
    if (avg > SLOW && !this.floor && this.level < this.ratios.length - 1) {
      this.tooSlow[this.level] = this.clock;
      this.trial = { from: this.level, before: avg };
      this.smooth = 0;
      this.set(this.level + 1);
    } else if (avg < SMOOTH && this.level > 0) {
      const up = this.level - 1;
      if (++this.smooth >= PATIENCE && !(this.clock - (this.tooSlow[up] ?? -Infinity) < COOLDOWN)) {
        this.smooth = 0;
        this.set(up);
      }
    } else {
      this.smooth = 0;
    }
  }
}
