// The words over the hall: the phrase, its count and how far the round has come, a line of
// guidance under it when there is something to say, and the controls.
import { phraseIndex, withinRound } from './motion.js';

const $ = s => document.querySelector(s);

export class Overlay {
  constructor(phrases, round, { onMode, onReset }) {
    this.phrases = phrases;
    this.round = round;
    this.el = { phrase: $('#phrase'), gloss: $('#gloss'), n: $('#n'), of: $('#of'), hint: $('#hint'), rose: $('#rose'), progress: $('#progress') };
    this.el.of.textContent = `/ ${round}`;
    this.modes = [...document.querySelectorAll('[data-mode]')];
    // A mouse click leaves focus on the button, and Space would then press it again
    // instead of counting; so let go of focus after pointer clicks (keyboard users keep it).
    const release = (e, b) => { if (e.detail > 0) b.blur(); };
    this.modes.forEach(b => b.addEventListener('click', e => { release(e, b); onMode(b.dataset.mode); }));
    const reset = $('#reset');
    reset.addEventListener('click', e => { release(e, reset); onReset(); });
    this.touch = matchMedia('(hover: none), (pointer: coarse)').matches;
    this.hintText = null;
  }

  /** What to say under the count: how to begin, where the walk leads, and how many are left. */
  hintFor(count, n, mode) {
    if (count === 0) return this.touch ? 'Tap anywhere to count' : 'Click anywhere or press Space to count';
    if (mode === 'arrive') {
      if (n === this.round) return this.touch ? 'Tap to begin the next round' : 'Click or press Space to begin the next round';
      const left = this.round - n;
      if (left <= 5) return `${left} more to the dome`;
      if (count <= 3) return 'Each count, one bay nearer the mihrab';
    } else if (count <= 3) {
      return 'Each count, one bay further down the hall';
    }
    return '';
  }

  hint(text) {
    if (text === this.hintText) return;
    this.hintText = text;
    if (text) this.el.hint.textContent = text; // an empty hint fades out with its last words
    this.el.hint.classList.toggle('gone', !text);
  }

  /** The name of the rose overhead, shown on arriving under it; '' hides it. */
  rose(name) {
    if (name === this.roseName) return;
    this.roseName = name;
    if (name) this.el.rose.textContent = name;
    this.el.rose.classList.toggle('shown', Boolean(name));
  }

  show({ count, mode }) {
    const n = withinRound(count, this.round);
    const p = phraseIndex(count, this.round, this.phrases.length);
    const [phrase, gloss] = this.phrases[p];
    this.el.phrase.textContent = phrase;
    this.el.gloss.textContent = n === this.round ? `Next: ${this.phrases[(p + 1) % this.phrases.length][0]}` : gloss;
    this.el.n.textContent = n;
    this.el.progress.style.transform = `scaleX(${n / this.round})`;
    this.modes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    this.hint(this.hintFor(count, n, mode));
  }
}
