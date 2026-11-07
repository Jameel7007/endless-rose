// Every number that shapes the hall lives here. Metres, seconds and degrees.

export const HALL = {
  bay: 3.2,           // column to column along the arcades, toward the qibla
  aisle: 5.0,         // arcade to arcade in the side field
  nave: 8.0,          // arcade to arcade across the central nave
  linesPerSide: 18,   // side arcades on each side of the nave (about 94 m of field)
  rowsBehind: 6,      // rows of columns kept behind the camera
  rowsAhead: 32,      // rows kept ahead; the haze hides anything further
  ceiling: 9.0,
  transverse: 8.0,    // depth of the aisle along the qibla wall: the bar of the T
};

export const SUPPORT = {
  plinth: 0.56,       // square plinth under the column
  plinthTop: 0.12,
  baseTop: 0.3,
  shaftRadius: 0.19,
  shaftTop: 3.25,
  capital: 0.56,      // width of the capital's square top
  capitalTop: 3.62,
  impost: 0.8,        // the block the arches spring from
  impostTop: 3.85,
  pier: 0.5,          // the pier above the column; also the thickness of every arcade wall
  pierTop: 6.2,       // the upper arches spring from here
};

export const ARCH = {
  rise: 0.4,            // lower horseshoe: its centre sits this far above the springing line
  inset: 0.05,          // gap between a horseshoe's widest point and the pier face
  ribDepth: 0.28,       // depth of the lower horseshoe rib
  transverseRise: 0.6,  // the larger horseshoes of the transverse arcade
};

export const QIBLA = {
  wall: 0.5,          // wall thickness
  mihrabWidth: 1.7,
  mihrabHeight: 3.3,  // floor to the top of the mihrab's horseshoe
  rise: 0.25,         // the mihrab's horseshoe
  dome: 4.0,          // radius; it covers the bay in front of the mihrab
  stopBeforeDome: 3.0, // the last count stops this far before the dome's centre, 7 m from the wall
  oculus: 0.35,       // radius of the opening at the dome's crown
};

export const MOTION = {
  round: 33,          // counts in one phrase, and in one approach to the mihrab
  stiffness: 2.4,     // how quickly the glide settles (1/s); higher is snappier
  horizon: 26,        // "Ahead" mode: the qibla wall stays this many bays away
  fadeOut: 0.45,      // the wash of light that hides a jump
  fadeIn: 0.9,
};

export const VIEW = {
  eye: 1.6,
  pitch: 4,           // resting tilt, up from level
  fovLandscape: 58,   // vertical field of view
  fovPortrait: 72,
  yaw: 32,            // how far the gaze can turn either way
  pitchUp: 30,
  pitchDown: 8,
  dead: 0.12,         // desktop: centre of the screen where the pointer doesn't turn the head
  swipe: 0.004,       // touch: radians of turn per pixel of swipe
  gazeSmoothing: 0.45,
  arriveTilt: 63,     // on arriving under the dome the gaze rises this far: the whole rose in view
  tiltSmoothing: 1.6,
};

export const LOOK = {
  plaster: 0xece4d7,
  floor: 0xd6cab8,
  ceiling: 0xe6ddcf,
  lantern: 0xffc46a,
  lanternGlow: 0.8,
  mihrab: 0xffc873,
  mihrabLight: 6,
  mihrabGlow: 1.5,
};

// The light of the day. The haze, sky light, sunlight and lanterns for each height of the sun
// are in src/sky/look.js.
export const SKY = {
  opening: 1.8,       // square openings in the ceiling (where: isOpen() in src/layout.js)
  well: 0.6,          // depth of the light well above each opening
  solidFrom: 7.6,     // the arcade walls are solid above the crowns of their upper arches
  beamsWithin: 36,    // beams of light are drawn for openings this close
  lanternLight: 6.5,  // how strongly the lanterns light the plaster near them
  method: 'mwl',      // prayer-time method, from METHODS in src/sky/sun.js
  asr: 'standard',    // or 'hanafi'
};

export const LANTERNS = { nave: 4.7, side: 4.4 }; // hanging heights

export const PHRASES = [
  ['SubhanAllah', 'Glory be to God'],
  ['Alhamdulillah', 'All praise is due to God'],
  ['Allahu Akbar', 'God is greater'],
];
