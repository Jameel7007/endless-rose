// Endless Rose: an endless T-plan prayer hall in plain plaster, lit by the real day.
// Each count of dhikr moves you one bay down the nave toward the mihrab; the sun comes in
// through openings in the ceiling where it truly stands, and the hall keeps the prayer times.
import * as THREE from 'three';
import { ARCH, HALL, LOOK, MOTION, PHRASES, QIBLA, SKY, SUPPORT, VIEW } from './config.js';
import { arriveCut, arriveStop, spring, step, withinRound } from './motion.js';
import { Roses, dayIndex } from './rose/rose.js';
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
import { Quality } from './quality.js';

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

// The rose in the dome: a new one every round, starting from today's.
const roses = new Roses(matchMedia('(pointer: coarse)').matches ? 1024 : 2048,
  Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const roseUniforms = { uRose: { value: roses.colour }, uRoseOrder: { value: roses.order }, uRoseProgress: { value: 0 } };
const today = dayIndex();
const finalStop = arriveStop(MOTION.round, MOTION, HALL, QIBLA);

const qibla = new Qibla({
  hall: HALL, support: SUPPORT, arch: ARCH, qibla: QIBLA, look: LOOK,
  lines: field.lines, halfWidth, supportGeometry: geometries.support, plaster, rose: roseUniforms,
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
  // Lamplight on the plaster only from dusk to dawn; by day the lanterns just glow.
  const lamplight = Math.min(1, Math.max(0, (look.lantern - 0.3) / 0.25));
  hallUniforms.uLanternColor.value.set(LOOK.lantern).multiplyScalar(look.lantern * lamplight * SKY.lanternLight);
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
    fader.start(() => { d = reduced.matches ? state.target : 0; v = 0; tilt = 0; }, MOTION.fadeOut, MOTION.fadeIn);
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

// Fewer pixels on devices that can't keep up (src/quality.js).
const quality = new Quality(Math.min(devicePixelRatio, 2), ratio => {
  renderer.setPixelRatio(ratio);
  renderer.setSize(innerWidth, innerHeight);
});

function resize() {
  renderer.setPixelRatio(quality.ratio);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? VIEW.fovPortrait : VIEW.fovLandscape;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const pitch0 = (VIEW.pitch * Math.PI) / 180;
const tiltUp = (VIEW.arriveTilt * Math.PI) / 180;
let last = performance.now();
let ready = false;
let sky;
let tilt = 0;       // the rise of the gaze on arriving under the dome
let aheadLaid = 0;  // in Ahead mode the rose is laid with the count instead of the walk

/**
 * The rose's laying: in Arrive mode it follows the walk down the nave, so the last tile is set
 * as you stop under the dome; a new rose is drawn while the dome is still bare. On arriving,
 * the gaze rises to it (not with reduced motion).
 */
function layRose(dt) {
  const n = withinRound(state.count, MOTION.round);
  const index = today + (state.count === 0 ? 0 : Math.floor((state.count - 1) / MOTION.round));
  let laid;
  if (state.mode === 'arrive') {
    laid = Math.min(1, Math.max(0, d / finalStop));
  } else {
    aheadLaid += (n / MOTION.round - aheadLaid) * (1 - Math.exp(-dt / 0.8));
    laid = aheadLaid;
  }
  roseUniforms.uRoseProgress.value = laid * 1.01; // a little past 1, so the last tile is set
  if (index !== roses.wanted && (laid < 0.02 || state.mode === 'ahead')) roses.show(index);
  const arrived = state.mode === 'arrive' && n === MOTION.round && d > finalStop - 2.5;
  tilt += ((arrived && !reduced.matches ? tiltUp : 0) - tilt) * (1 - Math.exp(-dt / VIEW.tiltSmoothing));
  overlay.rose(arrived && roses.shown === index ? roses.name : '');
}

function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw);
  last = now;
  quality.frame(raw);
  fader.update(dt);
  if (!fader.holding) [d, v] = spring(d, v, state.target, MOTION.stiffness, dt);
  input.update(dt);
  layRose(dt);

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
  camera.rotation.set(Math.min(1.45, pitch0 + input.pitch + tilt), Math.PI + input.yaw, 0); // yaw π: face +z, the qibla
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
      return { ...state, d, base: Math.floor(d / HALL.bay), yaw: input.yaw, pitch: input.pitch, fade: fader.level, tilt };
    },
    get rose() {
      return { laid: roseUniforms.uRoseProgress.value, shown: roses.shown, name: roses.name, today };
    },
    get ratio() {
      return quality.ratio;
    },
    get sky() {
      return { altitude: sky.altitude, period: sky.period, preview: clock.preview, place: clock.place, qibla: sky.qibla };
    },
    renderer,
  };
}
