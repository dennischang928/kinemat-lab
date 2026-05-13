import { calculateInverseKinematicsMatrix } from './ik.js';

const JOINT_KEYS = ['J1', 'J2', 'J3', 'J4', 'J5'];
const CARTESIAN_KEYS = ['x', 'y', 'z'];
const DEFAULT_SPIKE_THRESHOLD_DEG_PER_STEP = 20;
const DEFAULT_SPIKE_FACTOR = 4;
const CENTER_OFFSET_DEG = 148.335;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const toNumber = (value, fallback = 0) => {
	const numericValue = Number(value);
	return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeSegments = (segments) => Math.max(1, Math.floor(toNumber(segments, 1)));

const degToRad = (degrees) => toNumber(degrees) * (Math.PI / 180);
const radToDeg = (radians) => toNumber(radians) * (180 / Math.PI);

const interpolateSeries = (start = {}, end = {}, segments = 10, keys = []) => {
	const count = normalizeSegments(segments);
	const points = [];

	for (let i = 0; i <= count; i += 1) {
		const t = i / count;
		const point = {};

		keys.forEach((key) => {
			point[key] = lerp(start?.[key], end?.[key], t);
		});

		points.push(point);
	}

	return points;
};

export const lerp = (start, end, t) => {
	const alpha = clamp01(toNumber(t));
	return toNumber(start) + (toNumber(end) - toNumber(start)) * alpha;
};

export const interpolateNumber = (start, end, segments = 10) => {
	return interpolateSeries({ value: start }, { value: end }, segments, ['value']).map(({ value }) => value);
};

export const interpolateVector = (start = {}, end = {}, segments = 10, keys = CARTESIAN_KEYS) => {
	return interpolateSeries(start, end, segments, keys);
};

export const interpolateJoints = (startJoints = {}, endJoints = {}, segments = 10) => {
	return interpolateSeries(startJoints, endJoints, segments, JOINT_KEYS);
};

export const buildInterpolatedJointPath = (jointFrames = [], segmentsPerPair = 10) => {
	if (!Array.isArray(jointFrames) || jointFrames.length === 0) return [];
	if (jointFrames.length === 1) return [{ ...jointFrames[0] }];

	const path = [];

	for (let i = 0; i < jointFrames.length - 1; i += 1) {
		const current = jointFrames[i] || {};
		const next = jointFrames[i + 1] || {};
		const segmentPath = interpolateJoints(current, next, segmentsPerPair);

		if (i > 0) {
			segmentPath.shift();
		}

		path.push(...segmentPath);
	}

	return path;
};

const detectJointSpikes = (fullSequence = [], { segmentIndex = 0, segmentCount = 1, thresholdDegPerStep = DEFAULT_SPIKE_THRESHOLD_DEG_PER_STEP, spikeFactor = DEFAULT_SPIKE_FACTOR, sourceId = '' } = {}) => {
	if (!Array.isArray(fullSequence) || fullSequence.length < 2) return false;
	let foundSpike = false;
	const steps = fullSequence.length - 1;
	const perStepDeltas = [];
	for (let s = 0; s < steps; s += 1) {
		const a = fullSequence[s] || {};
		const b = fullSequence[s + 1] || {};
		JOINT_KEYS.forEach((joint) => {
			const da = Number(a[joint]) || 0;
			const db = Number(b[joint]) || 0;
			const delta = Math.abs(db - da);
			perStepDeltas.push({ stepIndex: s, joint, delta });
		});
	}

	const avgByJoint = {};
	JOINT_KEYS.forEach((joint) => {
		const vals = perStepDeltas.filter((d) => d.joint === joint).map((d) => d.delta);
		const avg = vals.length ? vals.reduce((p, c) => p + c, 0) / vals.length : 0;
		avgByJoint[joint] = avg;
	});

	perStepDeltas.forEach(({ stepIndex, joint, delta }) => {
		const avg = avgByJoint[joint] || 0;
		if (delta >= thresholdDegPerStep || (avg > 0 && delta >= avg * spikeFactor)) {
			foundSpike = true;
			const ratio = avg > 0 ? (delta / avg).toFixed(2) : '∞';
			console.warn(`[linear_interpolation] Joint spike detected: segment=${segmentIndex}, source=${sourceId || 'unknown'}, step=${stepIndex + 1}/${steps}, joint=${joint}, delta=${delta.toFixed(2)}° (avg=${avg.toFixed(2)}°, ratio=${ratio}), threshold=${thresholdDegPerStep}° per step`);
		}
	});

	return foundSpike;
};

/**
 * Cartesian linear interpolation between two frames using joint interpolation as the initial guess.
 */
export const interpolateCartesianWithIK = (fromFrame = {}, toFrame = {}, segments = 10) => {
	const count = normalizeSegments(segments);
	const jointPoints = [];

	const jointWaypoints = interpolateJoints(fromFrame.joints || {}, toFrame.joints || {}, count);

	let previousSolution = JOINT_KEYS.map((k) => degToRad(((fromFrame.joints || {})[k] || 0) - CENTER_OFFSET_DEG));

	for (let i = 1; i <= count; i += 1) {
		const t = i / count;
		const x = lerp(fromFrame.position?.x || 0, toFrame.position?.x || 0, t);
		const y = lerp(fromFrame.position?.y || 0, toFrame.position?.y || 0, t);
		const z = lerp(fromFrame.position?.z || 0, toFrame.position?.z || 0, t);

		const T = [
			[1, 0, 0, x],
			[0, 1, 0, y],
			[0, 0, 1, z],
			[0, 0, 0, 1],
		];

		const guessJointsDeg = jointWaypoints[i] || {};
		const guessRad = JOINT_KEYS.map((k) => degToRad((guessJointsDeg[k] || 0) - CENTER_OFFSET_DEG));

		const optimizedToGuess = guessRad.map((val, idx) => {
			const guess_weight = 0.5; // Adjust this weight to balance between the guess and the previous solution
			const previous_weight = 1 - guess_weight;
			return (val * guess_weight + previousSolution[idx] * previous_weight);
		});

		// console.log(optimizedToGuess)
		const numericOptions = {
			mask: [true, true, true, false, false, false],
			initialGuess: guessRad,
			optimizeToGuess: optimizedToGuess,
		};

		const sol = calculateInverseKinematicsMatrix(T, numericOptions);
		// console.log('IK guess:', guessJointsDeg, '->', sol ? { q1: radToDeg(sol.q1) + CENTER_OFFSET_DEG, q2: radToDeg(sol.q2) + CENTER_OFFSET_DEG, q3: radToDeg(sol.q3) + CENTER_OFFSET_DEG, q4: radToDeg(sol.q4) + CENTER_OFFSET_DEG, q5: radToDeg(sol.q5) + CENTER_OFFSET_DEG } : 'no solution');

		if (!sol) {
			console.warn(`IK failed at segment ${i}/${count} (t=${t.toFixed(2)}) - position (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) is unreachable.`);
			return { jointPoints: [], success: false };
		}

		previousSolution = [sol.q1, sol.q2, sol.q3, sol.q4, sol.q5];

		const jointsDeg = {
			J1: radToDeg(sol.q1) + CENTER_OFFSET_DEG,
			J2: radToDeg(sol.q2) + CENTER_OFFSET_DEG,
			J3: radToDeg(sol.q3) + CENTER_OFFSET_DEG,
			J4: radToDeg(sol.q4) + CENTER_OFFSET_DEG,
			J5: radToDeg(sol.q5) + CENTER_OFFSET_DEG,
		};

		jointPoints.push(jointsDeg);
	}

	return { jointPoints, success: true };
};

/**
 * Build a complete Cartesian interpolation plan for a sequence of frames.
 */
export const buildCartesianInterpolationPlan = (frames = [], interpolationSegments = 20, options = {}) => {
	if (!frames.length) return { plan: [], cartesianFallback: false };

	const segmentCount = normalizeSegments(interpolationSegments);
	const plan = [];
	let anyFallback = false;

	plan.push({
		joints: { ...frames[0].joints },
		feedrate: frames[0].feedrate,
		delayMs: 0,
		source: frames[0].id,
		interpolated: false,
		cartesian: true,
	});

	if (frames.length === 1) {
		return { plan, cartesianFallback: false };
	}

	for (let index = 0; index < frames.length - 1; index += 1) {
		const from = frames[index];
		const to = frames[index + 1];
		const transitionDelayMs = Math.max(0, from.delayMs || 0);
		const stepDelay = transitionDelayMs > 0 ? transitionDelayMs / segmentCount : 0;

		const result = interpolateCartesianWithIK(from, to, segmentCount);

		const spikeOpts = {
			segmentIndex: index,
			segmentCount,
			thresholdDegPerStep: Number(options.spikeThresholdDegPerStep) || DEFAULT_SPIKE_THRESHOLD_DEG_PER_STEP,
			spikeFactor: Number(options.spikeFactor) || DEFAULT_SPIKE_FACTOR,
			sourceId: `${from.id}->${to.id}`,
		};

		if (result && result.success) {
			try {
				const fullSequence = [from.joints, ...result.jointPoints];
				detectJointSpikes(fullSequence, spikeOpts);
			} catch (e) {
				console.error('[linear_interpolation] spike detection failed', e);
			}

			result.jointPoints.forEach((jointsDeg, pIndex) => {
				const t = (pIndex + 1) / Math.max(1, result.jointPoints.length);
				plan.push({
					joints: { ...jointsDeg },
					feedrate: Math.round(lerp(from.feedrate, to.feedrate, t)),
					delayMs: stepDelay,
					source: from.id,
					interpolated: true,
					cartesian: true,
				});
			});
		} else {
			anyFallback = true;
			const jointInterpolatedFull = interpolateJoints(from.joints, to.joints, segmentCount);
			try {
				detectJointSpikes(jointInterpolatedFull, spikeOpts);
			} catch (e) {
				console.error('[linear_interpolation] spike detection failed', e);
			}

			const jointInterpolated = jointInterpolatedFull.slice(1);
			const pointsCount = jointInterpolated.length || 1;
			const stepDelayJ = transitionDelayMs > 0 ? transitionDelayMs / pointsCount : 0;

			jointInterpolated.forEach((joints, pointIndex) => {
				plan.push({
					joints: { ...joints },
					feedrate: Math.round(lerp(from.feedrate, to.feedrate, (pointIndex + 1) / pointsCount)),
					delayMs: stepDelayJ,
					source: from.id,
					interpolated: true,
					cartesian: false,
				});
			});
		}
	}

	if (frames.length > 1) {
		plan.push({
			joints: { ...frames[frames.length - 1].joints },
			feedrate: frames[frames.length - 1].feedrate,
			delayMs: Math.max(0, frames[frames.length - 1].delayMs || 0),
			source: frames[frames.length - 1].id,
			interpolated: false,
			cartesian: true,
		});
	}

	return { plan, cartesianFallback: anyFallback };
};

export default {
	lerp,
	interpolateNumber,
	interpolateVector,
	interpolateJoints,
	buildInterpolatedJointPath,
	buildCartesianInterpolationPlan,
};
