// The words over the hall: the phrase, its count, and the two controls.
import { phraseIndex, withinRound } from './motion.js';

const $ = s => document.querySelector(s);

export class Overlay {
  constructor(phrases, round, { onMode, onReset }) {
    this.phrases = phrases;
    this.round = round;
    this.el = { phrase: $('#phrase'), gloss: $('#gloss'), n: $('#n'), of: $('#of'), hint: $('#hint'), rose: $('#rose') };
    this.el.of.textContent = `/ ${round}`;
    this.modes = [...document.querySelectorAll('[data-mode]')];
    // A mouse click leaves focus on the button, and Space would then press it again
    // instead of counting; so let go of focus after pointer clicks (keyboard users keep it).
    const release = (e, b) => { if (e.detail > 0) b.blur(); };
    this.modes.forEach(b => b.addEventListener('click', e => { release(e, b); onMode(b.dataset.mode); }));
    const reset = $('#reset');
    reset.addEventListener('click', e => { release(e, reset); onReset(); });
    const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
    this.el.hint.textContent = touch
      ? 'Tap to count · swipe to look around'
      : 'Click or press Space to count · move the pointer to look around';
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
    this.modes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (count > 0) this.el.hint.classList.add('gone');
  }
}
