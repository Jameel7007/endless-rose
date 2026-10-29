// Counting and looking. A tap, a click, Space or Enter is one count. On a desktop the
// pointer's position steers the gaze; on a touch screen a swipe turns the head instead,
// and a swipe never counts.
import { smooth } from './hall/pieces.js';

const SLOP = 10; // pixels a press can wander and still be a tap
const rad = d => (d * Math.PI) / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Input {
  constructor(canvas, view, onCount) {
    this.view = view;
    this.onCount = onCount;
    this.yaw = 0;      // + turns toward the viewer's left
    this.pitch = 0;    // + looks up
    this.tYaw = 0;
    this.tPitch = 0;
    this.press = null;
    this.hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.limits = { yaw: rad(view.yaw), up: rad(view.pitchUp), down: rad(view.pitchDown) };

    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', () => { this.press = null; });
    canvas.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse' && !this.press) this.tYaw = this.tPitch = 0;
    });
    addEventListener('keydown', e => this.key(e));
  }

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, look: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  move(e) {
    const p = this.press;
    if (p && p.id === e.pointerId) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) p.look = true;
      if (p.look && e.pointerType !== 'mouse') {
        // The world follows the finger: swipe right and the view turns left.
        this.turn((e.clientX - p.lx) * this.view.swipe, (e.clientY - p.ly) * this.view.swipe);
      }
      p.lx = e.clientX;
      p.ly = e.clientY;
    }
    if (this.hover && e.pointerType === 'mouse') this.aim(e.clientX, e.clientY);
  }

  up(e) {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    if (!p.look) this.onCount();
  }

  /** Desktop: the pointer's place on screen sets where the head turns, with a still centre. */
  aim(x, y) {
    const f = n => Math.sign(n) * smooth(this.view.dead, 1, Math.abs(n));
    const nx = (x / innerWidth) * 2 - 1;
    const ny = (y / innerHeight) * 2 - 1;
    this.tYaw = -f(nx) * this.limits.yaw;
    this.tPitch = -f(ny) * (ny < 0 ? this.limits.up : this.limits.down);
  }

  turn(dYaw, dPitch) {
    this.tYaw = clamp(this.tYaw + dYaw, -this.limits.yaw, this.limits.yaw);
    this.tPitch = clamp(this.tPitch + dPitch, -this.limits.down, this.limits.up);
  }

  key(e) {
    if (e.target.closest?.('button, input, select, textarea')) return; // let controls keep their keys
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) this.onCount();
      return;
    }
    const step = { ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0], ArrowUp: [0, 0.07], ArrowDown: [0, -0.07] }[e.key];
    if (step) {
      e.preventDefault();
      this.turn(step[0], step[1]);
    } else if (e.key === 'Home') {
      this.tYaw = this.tPitch = 0;
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt / this.view.gazeSmoothing);
    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;
  }
}
