import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

// ── Stepper motor math ──────────────────────────────────────────────
export const STEP_MAX = 1023;
export const DEG_PER_STEP = 0.29;
export const ANGLE_MAX = parseFloat((STEP_MAX * DEG_PER_STEP).toFixed(2));
export const CENTEROFFSETDEG = ANGLE_MAX / 2;

export const DEFAULT_JOINTS = {
  J1: ANGLE_MAX / 2,
  J2: ANGLE_MAX / 2,
  J3: ANGLE_MAX / 2,
  J4: ANGLE_MAX / 2,
  J5: ANGLE_MAX / 2,
};

// ── Feedrate ────────────────────────────────────────────────────────
export const FEEDRATE_MIN = 10;
export const FEEDRATE_MAX = 1000;

export const clampFeedrate = (value) =>
  Math.max(FEEDRATE_MIN, Math.min(FEEDRATE_MAX, value));

// ── Conversion helpers ──────────────────────────────────────────────
export const angleToSteps = (deg) =>
  Math.round(Math.max(0, Math.min(STEP_MAX, deg / DEG_PER_STEP)));

// ── Speed slider marks (shared by CommandPanel) ─────────────────────
export const SPEED_MARKS = [
  { value: 100, label: <DirectionsWalkIcon fontSize="small" /> },
  { value: 300, label: <DirectionsRunIcon fontSize="small" /> },
  { value: 500, label: <DirectionsBikeIcon fontSize="small" /> },
  { value: 700, label: <AirplanemodeActiveIcon fontSize="small" /> },
  { value: 900, label: <RocketLaunchIcon fontSize="small" /> },
];
