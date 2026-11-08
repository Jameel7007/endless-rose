// The guide: how the hall works, in four lines. It opens by itself on the first visit (remembered
// on this device only) and again from the Guide button. While it is open nothing counts.
const KEY = 'endless-rose:guided';
const $ = s => document.querySelector(s);

export class Guide {
  constructor({ touch, onClose }) {
    this.el = $('#guide');
    this.begin = $('#begin');
    this.onClose = onClose;
    $('#guide-count').textContent = touch ? 'Tap anywhere for each dhikr.' : 'Click anywhere, or press Space, for each dhikr.';
    $('#guide-look').textContent = touch ? 'Swipe to look around.' : 'Move the pointer to look around.';
    this.begin.addEventListener('click', () => this.el.close());
    // A click on the dimmed hall around the card closes it too (the card fills the dialog).
    this.el.addEventListener('click', e => { if (e.target === this.el) this.el.close(); });
    this.el.addEventListener('close', () => {
      try { localStorage.setItem(KEY, '1'); } catch { /* private browsing: it shows again next time */ }
      // Keyboard users go back to the Guide button. Otherwise let go of focus, so that Space
      // counts instead of pressing a button that is no longer on screen.
      if (this.opener) this.opener.focus();
      else if (this.el.contains(document.activeElement)) document.activeElement.blur();
      this.opener = null;
      this.onClose?.();
    });
    const open = $('#guide-open');
    open.addEventListener('click', e => {
      this.opener = e.detail > 0 ? null : open;
      if (e.detail > 0) open.blur(); // after a pointer click, Space should count, not reopen the guide
      this.open();
    });
  }

  get isOpen() {
    return this.el.open;
  }

  /** Open on the first visit only. */
  welcome() {
    let seen = null;
    try { seen = localStorage.getItem(KEY); } catch { /* as if new */ }
    if (!seen) this.open('Begin');
  }

  open(label = 'Continue') {
    if (this.el.open) return;
    this.begin.textContent = label;
    this.el.showModal();
    this.begin.focus();
  }
}
