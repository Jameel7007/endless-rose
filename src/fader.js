// A wash of warm light that hides a jump: a new approach, a change of mode, a reset.
// While it is fading out the camera holds still; the jump happens at full light.

export class Fader {
  constructor(el) {
    this.el = el;
    this.level = 0;
    this.shown = 0;
    this.phase = 'idle';
    this.pending = [];
  }

  /** Fade to light, run `atPeak` out of sight, then fade back. Overlapping calls share one peak. */
  start(atPeak, out, back) {
    this.pending.push(atPeak);
    this.out = out;
    this.back = back;
    this.phase = 'out';
  }

  get holding() {
    return this.phase === 'out';
  }

  update(dt) {
    if (this.phase === 'out') {
      this.level = Math.min(1, this.level + dt / this.out);
      if (this.level === 1) {
        const run = this.pending;
        this.pending = [];
        run.forEach(f => f());
        this.phase = 'in';
      }
    } else if (this.phase === 'in') {
      this.level = Math.max(0, this.level - dt / this.back);
      if (this.level === 0) this.phase = 'idle';
    }
    const o = this.level * this.level * (3 - 2 * this.level);
    if (o !== this.shown) {
      this.el.style.opacity = o;
      this.shown = o;
    }
  }
}
