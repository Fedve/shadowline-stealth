// SHADOWLINE — tuning constants, colours and sizes.
// One file, one job: every number the rest of the game balances against lives here.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 720

export const PLAYER_RADIUS = 13;
export const GUARD_RADIUS = 14;

export const PLAYER_RUN_SPEED = 175; // px per second
export const PLAYER_SNEAK_SPEED = 92;
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 148;
export const GUARD_INVESTIGATE_SPEED = 96;

export const VISION_RANGE = 235;
export const VISION_HALF_ANGLE = 0.58; // radians, ~33 degrees each side
export const CAMERA_RANGE = 260;
export const CAMERA_HALF_ANGLE = 0.5;

export const NOISE_RUN_RADIUS = 150;
export const NOISE_SNEAK_RADIUS = 34;
export const LURE_RANGE = 300;
export const LURE_HEAR_RADIUS = 200;
export const LURE_PER_LEVEL = 3;

export const SUSPICION_INVESTIGATE = 0.35;
export const SUSPICION_CHASE = 1.0;
export const SUSPICION_DECAY = 0.12; // per second, while unseen
export const CATCH_RADIUS = 26;

export const LIVES_START = 3;
export const INTEL_PER_LEVEL = 3;
export const SCORE_INTEL = 250;
export const SCORE_GHOST = 500;
export const SCORE_TIME_BONUS_MAX = 300;

export const COLOURS = {
  floorA: '#232a33',
  floorB: '#20262e',
  floorEdge: '#2c3540',
  shadow: '#141a21',
  shadowHatch: '#1b232d',
  wall: '#0d1117',
  wallTop: '#39434f',
  crate: '#5a4632',
  crateTop: '#7a6248',
  crateEdge: '#3c2f22',
  intel: '#37e0d8',
  intelGlow: 'rgba(55,224,216,0.35)',
  exitClosed: '#2f6b3a',
  exitOpen: '#39d353',
  exitGlow: 'rgba(57,211,83,0.30)',
  player: '#e8c547',
  playerDark: '#a8842a',
  guard: '#d64545',
  guardDark: '#8f2b2b',
  coneCalm: 'rgba(232,197,71,0.20)',
  coneAlert: 'rgba(214,69,69,0.30)',
  coneCamera: 'rgba(120,170,255,0.22)',
  coneCameraAlert: 'rgba(120,170,255,0.38)',
  text: '#e8ecf1',
  textDim: '#9aa7b4',
  hudBg: 'rgba(10,13,18,0.82)',
  alertLow: '#e8c547',
  alertHigh: '#d64545',
};
