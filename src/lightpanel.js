// The Light panel: today's prayer times, a way to preview the whole day, and the place the times
// are for. The line under the name always says whose prayer time it is, and which comes next.
import { LABELS, METHODS, PRAYERS } from './sky/sun.js';
import { currentPlace, forgetPlace, locate, savePlace } from './sky/place.js';

const $ = s => document.querySelector(s);
const clockTime = ms => (Number.isFinite(ms) ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const ROW = { fajr: 'fajr', morning: 'sunrise', dhuhr: 'dhuhr', asr: 'asr', maghrib: 'maghrib', isha: 'isha' };

export class LightPanel {
  constructor(clock) {
    this.clock = clock;
    this.el = {
      button: $('#light'), panel: $('#light-panel'), status: $('#status'), place: $('#place'),
      times: $('#times'), range: $('#preview'), out: $('#preview-out'), now: $('#now'),
      locate: $('#locate'), note: $('#place-note'), method: $('#method'), asr: $('#asr'),
    };
    const { el } = this;
    for (const [key, m] of Object.entries(METHODS)) el.method.add(new Option(m.name, key));
    el.method.value = clock.prefs.method;
    el.asr.value = clock.prefs.asr;
    el.times.innerHTML = PRAYERS.map(p => `<li data-p="${p}"><span>${LABELS[p]}</span><time></time></li>`).join('');

    el.button.addEventListener('click', e => {
      if (e.detail > 0) el.button.blur(); // as with the other buttons: Space should count, not press it again
      this.toggle();
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !el.panel.hidden) this.toggle(false); });
    el.range.addEventListener('input', () => { clock.preview = +el.range.value; });
    el.now.addEventListener('click', () => { clock.preview = null; });
    el.method.addEventListener('change', () => clock.setPrefs({ method: el.method.value }));
    el.asr.addEventListener('change', () => clock.setPrefs({ asr: el.asr.value }));
    el.locate.addEventListener('click', () => this.locate());
    this.shown = {};
  }

  toggle(open = this.el.panel.hidden) {
    this.el.panel.hidden = !open;
    this.el.button.setAttribute('aria-expanded', String(open));
  }

  async locate() {
    const { el, clock } = this;
    if (clock.place.source === 'device') {
      forgetPlace();
      clock.setPlace(currentPlace());
      el.note.textContent = 'Back to your time zone.';
      return;
    }
    el.note.textContent = 'Asking this device where it is…';
    try {
      const { lat, lon } = await locate();
      savePlace(lat, lon);
      clock.setPlace(currentPlace());
      el.note.textContent = 'Saved on this device only.';
    } catch (err) {
      el.note.textContent = err?.code === 1 ? 'Location wasn’t allowed, so the times follow your time zone.'
        : !isSecureContext ? 'Location needs a secure (https) address; the times follow your time zone.'
          : 'Location isn’t available here; the times follow your time zone.';
    }
  }

  /** Called every frame; touches the page only when something on it would change. */
  show(sky) {
    const { el, clock } = this;
    const p = sky.period;
    const status = `${clock.preview !== null ? 'Preview · ' : ''}${LABELS[p.now]} · ${LABELS[p.next]} ${clockTime(p.at)}`;
    if (status !== this.shown.status) {
      el.status.textContent = status;
      this.shown.status = status;
    }
    if (el.panel.hidden) return;
    const { place } = clock;
    const key = `${Math.floor(sky.ms / 60000)}|${place.lat},${place.lon}|${clock.prefs.method}|${clock.prefs.asr}|${clock.preview}`;
    if (key === this.shown.key) return;
    this.shown.key = key;
    const where = place.source === 'zone' ? `${place.label}, from your time zone` : place.label;
    el.place.textContent = `Times for ${where} · qibla ${Math.round(sky.qibla)}° from north`;
    for (const li of el.times.children) {
      li.querySelector('time').textContent = clockTime(sky.today[li.dataset.p]);
      if (li.dataset.p === ROW[p.now]) li.setAttribute('aria-current', 'time');
      else li.removeAttribute('aria-current');
    }
    const at = new Date(sky.ms);
    if (document.activeElement !== el.range) el.range.value = at.getHours() * 60 + at.getMinutes();
    el.out.textContent = clockTime(sky.ms);
    el.now.disabled = clock.preview === null;
    el.locate.textContent = place.source === 'device' ? 'Use the time zone' : 'Use my location';
  }
}
