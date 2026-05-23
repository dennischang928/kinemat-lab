import { Matrix, solve as solveLinearSystem } from 'ml-matrix';
import { calculateForwardKinematicsMatrix } from './fk.js';

/* ====== Geometry / robot constants ====== */
const UPPER_ARM = 0.106;
const FOREARM = 0.106;
const WRIST = 0.0645;
const BASE_HEIGHT = 0.0605;
const EPSILON = 1e-9;

/* ====== Small utilities ====== */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapToPi = (theta) => {
	const r = ((theta + Math.PI) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI) - Math.PI;
	return r === -Math.PI ? Math.PI : r;
};
const wrapJointVector = (vec) => vec.map((v) => wrapToPi(v));
const vectorNorm = (v) => Math.hypot(...v);
const jointDistance = (a, b) => a.reduce((s, _, i) => { const d = wrapToPi(a[i] - b[i]); return s + d * d; }, 0);

/* ====== Pose / mask helpers ====== */
const normalizePoseMask = (mask) => {
	const defaultMask = [true, true, true, true, true, true];
	if (!mask) return defaultMask;
	if (Array.isArray(mask)) return defaultMask.map((v, i) => Boolean(mask[i] ?? v));
	if (typeof mask !== 'object') return defaultMask;

	const t = Array.isArray(mask.translation) ? mask.translation : (Array.isArray(mask.position) ? mask.position : null);
	const r = Array.isArray(mask.rotation) ? mask.rotation : null;

	return [
		Boolean(mask.x ?? t?.[0] ?? mask.positionX ?? true),
		Boolean(mask.y ?? t?.[1] ?? mask.positionY ?? true),
		Boolean(mask.z ?? t?.[2] ?? mask.positionZ ?? true),
		Boolean(mask.roll ?? r?.[0] ?? mask.rotationX ?? true),
		Boolean(mask.pitch ?? r?.[1] ?? mask.rotationY ?? true),
		Boolean(mask.yaw ?? r?.[2] ?? mask.rotationZ ?? true),
	];
};
const activePoseRows = (mask) => mask.flatMap((enabled, idx) => (enabled ? [idx] : []));

/* ====== FK wrapper (small helper to keep calls concise) ====== */
const fkFromArray = (joints) => calculateForwardKinematicsMatrix({ q1: joints[0], q2: joints[1], q3: joints[2], q4: joints[3], q5: joints[4] });

/* ====== Pose error (translation + small-angle rotation error) ====== */
const matrixPoseError = (currentMatrix, targetMatrix) => {
	const curR = new Matrix([
		[currentMatrix[0][0], currentMatrix[0][1], currentMatrix[0][2]],
		[currentMatrix[1][0], currentMatrix[1][1], currentMatrix[1][2]],
		[currentMatrix[2][0], currentMatrix[2][1], currentMatrix[2][2]],
	]);
	const tgtR = new Matrix([
		[targetMatrix[0][0], targetMatrix[0][1], targetMatrix[0][2]],
		[targetMatrix[1][0], targetMatrix[1][1], targetMatrix[1][2]],
		[targetMatrix[2][0], targetMatrix[2][1], targetMatrix[2][2]],
	]);

	const Rerr = curR.transpose().mmul(tgtR).to2DArray();

	return [
		(targetMatrix[0][3] ?? 0) - (currentMatrix[0][3] ?? 0),
		(targetMatrix[1][3] ?? 0) - (currentMatrix[1][3] ?? 0),
		(targetMatrix[2][3] ?? 0) - (currentMatrix[2][3] ?? 0),
		0.5 * (Rerr[2][1] - Rerr[1][2]),
		0.5 * (Rerr[0][2] - Rerr[2][0]),
		0.5 * (Rerr[1][0] - Rerr[0][1]),
	];
};

/* ====== Numeric Jacobian + DLS step builder (returns delta vector) ====== */
const buildMaskedLeastSquaresStep = (joints, targetMatrix, activeRows, stepSize, damping, currentPoseError) => {
	if (activeRows.length === 0) return { delta: [0, 0, 0, 0, 0] };

	const error = activeRows.map((r) => currentPoseError[r]);
	const J = Array.from({ length: activeRows.length }, () => Array(5).fill(0));

	// compute FD columns
	for (let j = 0; j < 5; j++) {
		const plus = fkFromArray(joints.map((q, i) => (i === j ? q + stepSize : q)));
		const minus = fkFromArray(joints.map((q, i) => (i === j ? q - stepSize : q)));
		const ePlus = matrixPoseError(plus, targetMatrix);
		const eMinus = matrixPoseError(minus, targetMatrix);
		for (let r = 0; r < activeRows.length; r++) J[r][j] = (eMinus[activeRows[r]] - ePlus[activeRows[r]]) / (2 * stepSize);
	}

	const Jm = new Matrix(J);
	const JT = Jm.transpose();
	const N = JT.mmul(Jm);
	const rhs = JT.mmul(Matrix.columnVector(error));

	for (let d = 0; d < 5; d++) N.set(d, d, N.get(d, d) + damping * damping);

	const sol = solveLinearSystem(N.to2DArray(), rhs.to2DArray());
	if (!sol) return null;

	return { delta: sol.to1DArray() };
};

/* ====== Seed generation (analytic guess) ====== */
const createInitialJointGuess = (T, options = {}) => {
	const { initialGuess } = options;
	if (Array.isArray(initialGuess) && initialGuess.length >= 5) return wrapJointVector(initialGuess.slice(0, 5));

	const { elbow = 'down', preferredQ5 = 0 } = options;
	const sign = elbow === 'up' ? -1 : 1;

	const x = T[0][3] ?? 0; const y = T[1][3] ?? 0; const z = T[2][3] ?? 0;
	const r13 = T[0][2] ?? 0; const r23 = T[1][2] ?? 0; const r33 = T[2][2] ?? 0;

	const radial = Math.hypot(x, y);
	const q1 = radial > EPSILON ? Math.atan2(y, x) : Math.atan2(-r23, -r13);

	const c1 = Math.cos(q1), s1 = Math.sin(q1);
	const c234 = -(r13 * c1 + r23 * s1);
	const s234 = clamp(r33, -1, 1);
	const q234 = Math.atan2(s234, c234);
	const q5 = preferredQ5;

	const wristPlanar = radial - WRIST * Math.sin(q234);
	const wristVertical = z - BASE_HEIGHT - WRIST * Math.cos(q234);
	const wristDistSq = wristPlanar * wristPlanar + wristVertical * wristVertical;

	const rawCosQ3 = (wristDistSq - UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (2 * UPPER_ARM * FOREARM);
	if (rawCosQ3 < -1 - 1e-6 || rawCosQ3 > 1 + 1e-6) return null;

	const q3 = sign * Math.acos(clamp(rawCosQ3, -1, 1));
	const q2 = Math.atan2(wristPlanar, wristVertical) - Math.atan2(FOREARM * Math.sin(q3), UPPER_ARM + FOREARM * Math.cos(q3));
	const q4 = q234 - q2 - q3;

	return wrapJointVector([q1, q2, q3, q4, q5]);
};

/* ====== Local solver: Levenberg-Marquardt (per-seed) ====== */
const solveFromSeed = (seed, targetMatrix, poseMask, stepSize, damping, maxIterations, tolerance) => {
	const joints = [...seed];
	const active = activePoseRows(poseMask);

	let curMat = fkFromArray(joints);
	let curErr = matrixPoseError(curMat, targetMatrix);
	let curNorm = vectorNorm(active.map((r) => curErr[r]));

	const seedErrorNorm = curNorm;
	let bestNorm = curNorm;
	let iterations = 0;
	let converged = false;

	for (let it = 0; it < maxIterations; it++) {
		iterations = it + 1;
		if (curNorm <= tolerance) { converged = true; break; }

		const step = buildMaskedLeastSquaresStep(joints, targetMatrix, active, stepSize, damping, curErr);
		if (!step) break;

		const { delta } = step;
		for (let j = 0; j < 5; j++) joints[j] = wrapToPi(joints[j] + delta[j]);

		curMat = fkFromArray(joints);
		curErr = matrixPoseError(curMat, targetMatrix);
		curNorm = vectorNorm(active.map((r) => curErr[r]));

		if (curNorm < bestNorm) bestNorm = curNorm;
		if (vectorNorm(delta) <= tolerance) { if (curNorm <= tolerance) converged = true; break; }
	}

	return { joints: wrapJointVector(joints), errorNorm: curNorm, seedErrorNorm, bestErrorNorm: bestNorm, iterations, converged: converged || curNorm <= tolerance };
};

/* ====== Public API: top-level solver ====== */
export const calculateInverseKinematicsMatrix = (targetMatrix, options = {}) => {
	if (!Array.isArray(targetMatrix) || targetMatrix.length < 3) return null;

	const { mask = null, initialGuess = null, optimizeToGuess = null, maxIterations = 30, tolerance = 1e-10, damping = 1e-2, stepSize = 1e-4 } = options;
	const poseMask = normalizePoseMask(mask);

	// continuity/optimize mode: prefer solution near a previous joint vector
	if (Array.isArray(optimizeToGuess) && optimizeToGuess.length >= 5) {
		const wrappedPrev = wrapJointVector(optimizeToGuess.slice(0, 5));

		const elbowDownBase = createInitialJointGuess(targetMatrix, { elbow: 'down' });
		const elbowUpBase = createInitialJointGuess(targetMatrix, { elbow: 'up' });

		const seeds = [];
		if (elbowDownBase) seeds.push({ seed: elbowDownBase, name: 'down' });
		if (elbowUpBase) seeds.push({ seed: elbowUpBase, name: 'up' });
		seeds.push({ seed: wrappedPrev, name: 'warm' });

		let best = null; let minDist = Infinity; let bestByError = null; let minErr = Infinity;
		for (const { seed, name } of seeds) {
			const s = solveFromSeed(seed, targetMatrix, poseMask, stepSize, damping, maxIterations, tolerance);
			if (s.errorNorm < minErr) { minErr = s.errorNorm; bestByError = { ...s, name }; }
			if (s.converged) { const d = jointDistance(s.joints, wrappedPrev); if (d < minDist) { minDist = d; best = { ...s, name }; } }
		}

		const final = best || bestByError;
		if (!final) return null;

		return { q1: final.joints[0], q2: final.joints[1], q3: final.joints[2], q4: final.joints[3], q5: final.joints[4], reachable: true, converged: final.converged, iterations: final.iterations, errorNorm: final.errorNorm, seedErrorNorm: final.seedErrorNorm, bestErrorNorm: final.bestErrorNorm, mask: poseMask, continuityMode: true, elbow: final.name };
	}

	// build candidate seeds
	const candidates = [];
	if (Array.isArray(initialGuess) && initialGuess.length >= 5) candidates.push(wrapJointVector(initialGuess.slice(0, 5)));
	const down = createInitialJointGuess(targetMatrix, { elbow: 'down' }); if (down) candidates.push(down);
	const up = createInitialJointGuess(targetMatrix, { elbow: 'up' }); if (up) candidates.push(up);
	candidates.push([0, 0, 0, 0, 0]);
	const base = down || up || [0, 0, 0, 0, 0];
	for (let i = 0; i < 4; i++) candidates.push(base.map((q) => wrapToPi(q + (Math.random() - 0.5) * 1.0)));

	let bestResult = null; let bestErr = Infinity;
	for (const seed of candidates) {
		const s = solveFromSeed(seed, targetMatrix, poseMask, stepSize, damping, maxIterations, tolerance);
		if (s.converged && s.errorNorm < bestErr) {
			bestErr = s.errorNorm;
			bestResult = { q1: s.joints[0], q2: s.joints[1], q3: s.joints[2], q4: s.joints[3], q5: s.joints[4], reachable: true, converged: true, iterations: s.iterations, errorNorm: s.errorNorm, seedErrorNorm: s.seedErrorNorm, bestErrorNorm: s.bestErrorNorm, mask: poseMask };
			if (s.errorNorm <= tolerance * 0.1) break;
		}
	}

	return bestResult;
};

/* ====== Convenience and analytic helpers ====== */
export const calculateInverseKinematicsMatrixDegrees = (targetMatrix, options = {}) => {
	const sol = calculateInverseKinematicsMatrix(targetMatrix, options);
	if (!sol) return null;
	const toDeg = (r) => r * (180 / Math.PI);
	return { ...sol, q1: toDeg(sol.q1), q2: toDeg(sol.q2), q3: toDeg(sol.q3), q4: toDeg(sol.q4), q5: toDeg(sol.q5) };
};

/* Position-only analytic IK (phi-based wrist) - returns radians or null.
 * Accepts either (targetMatrix) or (x, options) / (x, y, z).
 */
export const calculateInverseKinematicsPosition = (targetMatrixOrX, yOrOptions, zIfProvided) => {
	let x, y, z, options = {};
	if (Array.isArray(targetMatrixOrX)) { const T = targetMatrixOrX; x = T[0]?.[3] ?? 0; y = T[1]?.[3] ?? 0; z = T[2]?.[3] ?? 0; options = yOrOptions || {}; }
	else { x = parseFloat(targetMatrixOrX) || 0; if (typeof yOrOptions === 'object' && yOrOptions !== null && zIfProvided === undefined) { options = yOrOptions; y = parseFloat(options.y) || 0; z = parseFloat(options.z) || 0; } else { y = parseFloat(yOrOptions) || 0; z = parseFloat(zIfProvided) || 0; } }

	const { phi = 0, q5 = 0, elbow = 'up' } = options;
	const L1 = BASE_HEIGHT, L2 = UPPER_ARM, L3 = FOREARM, L4 = WRIST;

	const q1 = Math.atan2(y, x);
	const r = Math.hypot(x, y);
	const rho = r - L4 * Math.cos(phi);
	const sigma = L1 - z - L4 * Math.sin(phi);

	const denom = 2 * L2 * L3;
	const D = (rho * rho + sigma * sigma - L2 * L2 - L3 * L3) / (denom || EPSILON);
	if (D < -1 - 1e-9 || D > 1 + 1e-9) return null;

	const clippedD = clamp(D, -1, 1);
	const q3pos = Math.atan2(Math.sqrt(Math.max(0, 1 - clippedD * clippedD)), clippedD);
	const q3neg = Math.atan2(-Math.sqrt(Math.max(0, 1 - clippedD * clippedD)), clippedD);
	const q3 = elbow === 'down' ? q3neg : q3pos;

	const q2 = Math.atan2(sigma, rho) - Math.atan2(L3 * Math.sin(q3), L2 + L3 * Math.cos(q3));
	const q4 = phi - q2 - q3;

	return { q1, q2, q3, q4, q5, reachable: true, converged: true, method: 'analytic-position', phi, D: clippedD };
};

export const calculateInverseKinematicsPositionDegrees = (targetMatrixOrX, yOrOptions, zIfProvided) => {
	const sol = calculateInverseKinematicsPosition(targetMatrixOrX, yOrOptions, zIfProvided); if (!sol) return null; const toDeg = (r) => r * (180 / Math.PI); return { ...sol, q1: toDeg(sol.q1), q2: toDeg(sol.q2), q3: toDeg(sol.q3), q4: toDeg(sol.q4), q5: toDeg(sol.q5) };
};
