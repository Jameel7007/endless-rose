// Endless Rose: an endless T-plan prayer hall in plain plaster, lit by the real day.
// Each count of dhikr moves you one bay down the nave toward the mihrab; the sun comes in
// through openings in the ceiling where it truly stands, and the hall keeps the prayer times.
import * as THREE from 'three';
import { ARCH, HALL, LOOK, MOTION, PHRASES, QIBLA, SKY, SUPPORT, VIEW } from './config.js';
import { arriveCut, arriveStop, spring, step } from './motion.js';
import { arcadeBayGeometry, supportGeometry } from './hall/pieces.js';
import { Field } from './hall/field.js';
import { Lanterns } from './hall/lanterns.js';
import { Qibla } from './hall/qibla.js';
import { Surfaces } from './hall/surfaces.js';
import { Openings } from './hall/beams.js';
import { hallUniforms, litMaterial } from './hall/light.js';
import { Clock, urlPreview } from './sky/clock.js';
import { lookAt } from './sky/look.js';
import { currentPlace } from './sky/place.js';
import { Fader } from './fader.js';
import { Input } from './input.js';
import { Overlay } from './overlay.js';
import { LightPanel } from './lightpanel.js';

const canvas = document.getElementById('hall');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  document.getElementById('nogl').hidden = false;
  throw err;
}
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.FogExp2(0xffffff, 0.017);

const camera = new THREE.PerspectiveCamera(VIEW.fovLandscape, 1, 0.1, 400);
camera.rotation.order = 'YXZ';

// Light from the sky through the openings, and its bounce off the floor. The sun itself is
// worked out per pixel in src/hall/light.js; this soft fill only gives the plaster its form.
const hemi = new THREE.HemisphereLight();
const fill = new THREE.DirectionalLight();
scene.add(hemi, fill);

// ---- The hall --------------------------------------------------------------------------

const plaster = litMaterial(new THREE.MeshStandardMaterial({ color: LOOK.plaster, roughness: 0.94, vertexColors: true }));
const geometries = { support: supportGeometry(SUPPORT), bay: arcadeBayGeometry(HALL, SUPPORT, ARCH) };
const field = new Field(HALL, geometries, plaster);
const halfWidth = Math.max(...field.lines) + HALL.aisle / 2;
const lanterns = new Lanterns(HALL, field.lines, LOOK);
const surfaces = new Surfaces(HALL, LOOK, halfWidth + 2);
const qibla = new Qibla({
  hall: HALL, support: SUPPORT, arch: ARCH, qibla: QIBLA, look: LOOK,
  lines: field.lines, halfWidth, supportGeometry: geometries.support, plaster,
});
const openings = new Openings(HALL, SKY, field.lines,
  litMaterial(new THREE.MeshStandardMaterial({ color: LOOK.ceiling, roughness: 0.95, side: THREE.BackSide })));
scene.add(field.group, lanterns.group, surfaces.group, qibla.group, openings.group);

// ---- The day ---------------------------------------------------------------------------

const clock = new Clock(currentPlace(), { method: SKY.method, asr: SKY.asr });
clock.preview = urlPreview(location.search);
const panel = new LightPanel(clock);

const setLinear = (color, [r, g, b]) => color.setRGB(r, g, b);
const root = document.documentElement;

/** Light the hall for the moment the clock shows. */
function light(sky, look, base, cut) {
  setLinear(scene.background, look.haze);
  scene.fog.color.copy(scene.background);
  scene.fog.density = look.fog;
  setLinear(hemi.color, look.sky);
  setLinear(hemi.groundColor, look.ground);
  hemi.intensity = look.hemi;
  setLinear(fill.color, look.sky);
  fill.intensity = look.hemi * 0.3;
  fill.position.set(sky.dir[0] * 0.6, 1, sky.dir[2] * 0.6); // from above, leaning toward the sun
  renderer.toneMappingExposure = look.exposure;

  hallUniforms.uSunDir.value.fromArray(sky.dir);
  setLinear(hallUniforms.uSunColor.value, look.sun).multiplyScalar(look.sunI);
  hallUniforms.uLanternColor.value.set(LOOK.lantern).multiplyScalar(look.lantern * SKY.lanternLight);
  hallUniforms.uParity.value = ((base % 2) + 2) % 2;
  hallUniforms.uDome.value.set(0, HALL.ceiling, cut + HALL.transverse / 2);

  // After sunset the words over the hall turn light on dark.
  const dark = sky.altitude < -0.5;
  if (dark !== root.hasAttribute('data-dark')) root.toggleAttribute('data-dark', dark);

  lanterns.setLight(look.lantern, LOOK.lanternGlow, look.fog);
  qibla.setLight(look.sky, look.lantern, look.fog);
  openings.update(base, cut, sky.dir, look.beam, look.sun, look.fog);
}

// ---- Counting and moving ---------------------------------------------------------------

const state = { count: 0, mode: 'arrive', target: 0 };
let d = 0; // distance down the nave: within the current approach (arrive) or since the start (ahead)
let v = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fader = new Fader(document.getElementById('fade'));

function count() {
  const next = step(state, MOTION, HALL, QIBLA);
  state.count = next.count;
  state.target = next.target;
  if (next.restart) {
    // Back to the start of the nave for the next phrase, hidden in a wash of light.
    fader.start(() => { d = reduced.matches ? state.target : 0; v = 0; }, MOTION.fadeOut, MOTION.fadeIn);
  } else if (reduced.matches) {
    // No glide: the hall repeats bay by bay, so a cut of one bay is barely visible.
    d = state.target;
    v = 0;
  }
  overlay.show(state);
}

function setMode(mode) {
  if (mode === state.mode) return;
  overlay.show({ ...state, mode });
  fader.start(() => {
    state.mode = mode;
    if (mode === 'arrive') {
      state.target = arriveStop(state.count, MOTION, HALL, QIBLA);
      d = state.target;
      v = 0;
    }
  }, MOTION.fadeOut, MOTION.fadeIn);
}

function reset() {
  fader.start(() => {
    state.count = 0;
    state.target = 0;
    d = 0;
    v = 0;
    overlay.show(state);
  }, MOTION.fadeOut, MOTION.fadeIn);
}

const overlay = new Overlay(PHRASES, MOTION.round, { onMode: setMode, onReset: reset });
const input = new Input(canvas, VIEW, count);
overlay.show(state);

// ---- Frame -----------------------------------------------------------------------------

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? VIEW.fovPortrait : VIEW.fovLandscape;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const pitch0 = (VIEW.pitch * Math.PI) / 180;
let last = performance.now();
let ready = false;
let sky;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fader.update(dt);
  if (!fader.holding) [d, v] = spring(d, v, state.target, MOTION.stiffness, dt);
  input.update(dt);

  // The floating origin: shift the world back by whole bays so the camera stays in bay 0.
  const base = Math.floor(d / HALL.bay);
  const local = d - base * HALL.bay;
  const cut = (state.mode === 'arrive' ? arriveCut(MOTION, HALL) : d + MOTION.horizon * HALL.bay) - base * HALL.bay;
  field.update(cut);
  lanterns.update(base, cut);
  surfaces.update(cut, cut + HALL.transverse);
  qibla.group.position.z = cut;

  sky = clock.read();
  light(sky, lookAt(sky.altitude, sky.evening), base, cut);
  panel.show(sky);

  camera.position.set(0, VIEW.eye, local);
  camera.rotation.set(pitch0 + input.pitch, Math.PI + input.yaw, 0); // yaw π: face +z, the qibla
  renderer.render(scene, camera);

  if (!ready) {
    ready = true;
    document.documentElement.dataset.ready = '1';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only view of the state for development checks (not available in the build).
if (import.meta.env.DEV) {
  window.__hall = {
    get state() {
      return { ...state, d, base: Math.floor(d / HALL.bay), yaw: input.yaw, pitch: input.pitch, fade: fader.level };
    },
    get sky() {
      return { altitude: sky.altitude, period: sky.period, preview: clock.preview, place: clock.place, qibla: sky.qibla };
    },
    renderer,
  };
}
