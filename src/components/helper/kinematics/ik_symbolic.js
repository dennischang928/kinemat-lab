import { Matrix, solve as solveLinearSystem } from 'ml-matrix';
import { calculateForwardKinematicsMatrix, calculateForwardKinematicsMatrixDegrees } from './fk';

/**
 * Forward and inverse kinematics helpers for the 5-DOF arm.
 * Angles are in radians unless otherwise noted.
 */

const UPPER_ARM = 0.106;
const FOREARM = 0.106;
const WRIST = 0.0645;
const BASE_HEIGHT = 0.0605;
const EPSILON = 1e-9;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const wrapToPi = (angle) => {
	const wrapped = ((angle + Math.PI) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI) - Math.PI;
	return wrapped === -Math.PI ? Math.PI : wrapped;
};

const wrapJointVector = (jointVector) => jointVector.map((angle) => wrapToPi(angle));

const matrixPoseError = (currentMatrix, targetMatrix) => {
	const currentRotation = new Matrix([
		[currentMatrix[0][0], currentMatrix[0][1], currentMatrix[0][2]],
		[currentMatrix[1][0], currentMatrix[1][1], currentMatrix[1][2]],
		[currentMatrix[2][0], currentMatrix[2][1], currentMatrix[2][2]],
	]);
	const targetRotation = new Matrix([
		[targetMatrix[0][0], targetMatrix[0][1], targetMatrix[0][2]],
		[targetMatrix[1][0], targetMatrix[1][1], targetMatrix[1][2]],
		[targetMatrix[2][0], targetMatrix[2][1], targetMatrix[2][2]],
	]);
	const rotationErrorMatrix = currentRotation.transpose().mmul(targetRotation).to2DArray();

	return [
		(targetMatrix[0][3] ?? 0) - (currentMatrix[0][3] ?? 0),
		(targetMatrix[1][3] ?? 0) - (currentMatrix[1][3] ?? 0),
		(targetMatrix[2][3] ?? 0) - (currentMatrix[2][3] ?? 0),
		0.5 * (rotationErrorMatrix[2][1] - rotationErrorMatrix[1][2]),
		0.5 * (rotationErrorMatrix[0][2] - rotationErrorMatrix[2][0]),
		0.5 * (rotationErrorMatrix[1][0] - rotationErrorMatrix[0][1]),
	];
};

const normalizePoseMask = (mask) => {
	const defaultMask = [true, true, true, true, true, true];

	if (!mask) {
		return defaultMask;
	}

	if (Array.isArray(mask)) {
		return defaultMask.map((value, index) => Boolean(mask[index] ?? value));
	}

	if (typeof mask !== 'object') {
		return defaultMask;
	}

	const translationMask = Array.isArray(mask.translation)
		? mask.translation
		: Array.isArray(mask.position)
			? mask.position
			: null;
	const rotationMask = Array.isArray(mask.rotation) ? mask.rotation : null;

	return [
		Boolean(mask.x ?? translationMask?.[0] ?? mask.positionX ?? true),
		Boolean(mask.y ?? translationMask?.[1] ?? mask.positionY ?? true),
		Boolean(mask.z ?? translationMask?.[2] ?? mask.positionZ ?? true),
		Boolean(mask.roll ?? rotationMask?.[0] ?? mask.rotationX ?? true),
		Boolean(mask.pitch ?? rotationMask?.[1] ?? mask.rotationY ?? true),
		Boolean(mask.yaw ?? rotationMask?.[2] ?? mask.rotationZ ?? true),
	];
};

const activePoseRows = (mask) => mask.flatMap((enabled, index) => (enabled ? [index] : []));

const createInitialJointGuess = (targetMatrix, options = {}) => {
	const { initialGuess } = options;

	if (Array.isArray(initialGuess) && initialGuess.length >= 5) {
		return wrapJointVector(initialGuess.slice(0, 5));
	}

	const { elbow = 'down', preferredQ5 = 0 } = options;
	const sign = elbow === 'up' ? -1 : 1;

	const x = targetMatrix[0][3] ?? 0;
	const y = targetMatrix[1][3] ?? 0;
	const z = targetMatrix[2][3] ?? 0;
	const r13 = targetMatrix[0][2] ?? 0;
	const r23 = targetMatrix[1][2] ?? 0;
	const r33 = targetMatrix[2][2] ?? 0;
	const r31 = targetMatrix[2][0] ?? 0;
	const r32 = targetMatrix[2][1] ?? 0;

	const radial = Math.hypot(x, y);
	const q1 = radial > EPSILON ? Math.atan2(y, x) : Math.atan2(-r23, -r13);

	const c1 = Math.cos(q1);
	const s1 = Math.sin(q1);
	const c234 = -(r13 * c1 + r23 * s1);
	const s234 = clamp(r33, -1, 1);
	const q234 = Math.atan2(s234, c234);
	const q5 = Math.abs(c234) > EPSILON ? Math.atan2(-r32, r31) : preferredQ5;

	const wristPlanar = radial - WRIST * Math.sin(q234);
	const wristVertical = z - BASE_HEIGHT - WRIST * Math.cos(q234);
	const wristDistanceSq = wristPlanar * wristPlanar + wristVertical * wristVertical;
	const rawCosQ3 = (wristDistanceSq - UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (2 * UPPER_ARM * FOREARM);
	if (rawCosQ3 < -1 - 1e-6 || rawCosQ3 > 1 + 1e-6) {
		return null;
	}

	const q3 = sign * Math.acos(clamp(rawCosQ3, -1, 1));
	const q2 = Math.atan2(wristPlanar, wristVertical) - Math.atan2(FOREARM * Math.sin(q3), UPPER_ARM + FOREARM * Math.cos(q3));
	const q4 = q234 - q2 - q3;

	return wrapJointVector([q1, q2, q3, q4, q5]);
};

const buildMaskedLeastSquaresStep = (joints, targetMatrix, mask, stepSize, damping) => {
	const currentMatrix = calculateForwardKinematicsMatrix({
		q1: joints[0],
		q2: joints[1],
		q3: joints[2],
		q4: joints[3],
		q5: joints[4],
	});
	const poseError = matrixPoseError(currentMatrix, targetMatrix);
	const activeRows = activePoseRows(mask);

	if (activeRows.length === 0) {
		return { error: [], delta: [0, 0, 0, 0, 0], errorNorm: 0 };
	}

	const error = activeRows.map((rowIndex) => poseError[rowIndex]);
	const jacobian = Array.from({ length: activeRows.length }, () => Array(5).fill(0));

	for (let jointIndex = 0; jointIndex < 5; jointIndex += 1) {
		const plus = [...joints];
		const minus = [...joints];
		plus[jointIndex] += stepSize;
		minus[jointIndex] -= stepSize;

		const plusError = matrixPoseError(
			calculateForwardKinematicsMatrix({ q1: plus[0], q2: plus[1], q3: plus[2], q4: plus[3], q5: plus[4] }),
			targetMatrix,
		);
		const minusError = matrixPoseError(
			calculateForwardKinematicsMatrix({ q1: minus[0], q2: minus[1], q3: minus[2], q4: minus[3], q5: minus[4] }),
			targetMatrix,
		);

		for (let rowIndex = 0; rowIndex < activeRows.length; rowIndex += 1) {
			const poseRow = activeRows[rowIndex];
			jacobian[rowIndex][jointIndex] = (minusError[poseRow] - plusError[poseRow]) / (2 * stepSize);
		}
	}

	const jacobianMatrix = new Matrix(jacobian);
	const jacobianTranspose = jacobianMatrix.transpose();
	const normalMatrix = jacobianTranspose.mmul(jacobianMatrix);
	const errorVector = Matrix.columnVector(error);
	const rhs = jacobianTranspose.mmul(errorVector);

	for (let diagonalIndex = 0; diagonalIndex < 5; diagonalIndex += 1) {
		normalMatrix.set(diagonalIndex, diagonalIndex, normalMatrix.get(diagonalIndex, diagonalIndex) + damping * damping);
	}

	const deltaMatrix = solveLinearSystem(normalMatrix.to2DArray(), rhs.to2DArray());
	if (!deltaMatrix) {
		return null;
	}

	const delta = deltaMatrix.to1DArray();

	return {
		error,
		delta,
		errorNorm: vectorNorm(error),
	};
};

const vectorNorm = (vector) => Math.hypot(...vector);

// Forward kinematics helpers are provided by ./fk — import above and use those implementations.

/**
 * Symbolic inverse kinematics for position-only solution.
 * Accepts a 4x4 target matrix (homogeneous transform) or explicit x,y,z.
 * Options:
 *  - phi: desired wrist angle (q2+q3+q4), default 0
 *  - q5: free joint 5 value, default 0
 *  - elbow: 'up' or 'down' (selects sign for q3), default 'up'
 */
export const calculateInverseKinematicsPosition = (targetMatrixOrX, yOrOptions, zIfProvided) => {
	let x; let y; let z; let options = {};

	if (Array.isArray(targetMatrixOrX)) {
		// matrix provided
		const T = targetMatrixOrX;
		x = T[0]?.[3] ?? 0;
		y = T[1]?.[3] ?? 0;
		z = T[2]?.[3] ?? 0;
		options = yOrOptions || {};
	} else {
		x = parseFloat(targetMatrixOrX) || 0;
		if (typeof yOrOptions === 'object' && yOrOptions !== null && zIfProvided === undefined) {
			options = yOrOptions;
			y = parseFloat(options.y) || 0;
			z = parseFloat(options.z) || 0;
		} else {
			y = parseFloat(yOrOptions) || 0;
			z = parseFloat(zIfProvided) || 0;
		}
	}

	const { phi = 0, q5 = 0, elbow = 'up' } = options;

	// link lengths mapping from file constants
	const L1 = BASE_HEIGHT; // 0.0605
	const L2 = UPPER_ARM; // 0.106
	const L3 = FOREARM; // 0.106
	const L4 = WRIST; // 0.0645

	const q1 = Math.atan2(y, x);
	const r = Math.hypot(x, y);
	const rho = r - L4 * Math.cos(phi);
	const sigma = L1 - z - L4 * Math.sin(phi);

	const denom = 2 * L2 * L3;
	const D = (rho * rho + sigma * sigma - L2 * L2 - L3 * L3) / (denom || EPSILON);

	if (D < -1 - 1e-9 || D > 1 + 1e-9) {
		return null; // unreachable
	}

	const clippedD = Math.max(-1, Math.min(1, D));

	const q3pos = Math.atan2(Math.sqrt(Math.max(0, 1 - clippedD * clippedD)), clippedD);
	const q3neg = Math.atan2(-Math.sqrt(Math.max(0, 1 - clippedD * clippedD)), clippedD);

	const q3 = elbow === 'down' ? q3neg : q3pos;

	const q2 = Math.atan2(sigma, rho) - Math.atan2(L3 * Math.sin(q3), L2 + L3 * Math.cos(q3));

	const q4 = phi - q2 - q3;

	return {
		q1,
		q2,
		q3,
		q4,
		q5,
		reachable: true,
		converged: true,
		method: 'symbolic-position',
		phi,
		D: clippedD,
	};
};

export const calculateInverseKinematicsPositionDegrees = (targetMatrixOrX, yOrOptions, zIfProvided) => {
	const sol = calculateInverseKinematicsPosition(targetMatrixOrX, yOrOptions, zIfProvided);
	if (!sol) return null;
	const toDeg = (rad) => rad * (180 / Math.PI);
	return {
		...sol,
		q1: toDeg(sol.q1),
		q2: toDeg(sol.q2),
		q3: toDeg(sol.q3),
		q4: toDeg(sol.q4),
		q5: toDeg(sol.q5),
	};
};

/**
 * Fast numerical inverse kinematics for the FK matrix above.
 *
 * @param {number[][]} targetMatrix - 4x4 homogeneous transform.
 * @param {Object} options - Solver options.
	* @param {Array<boolean|number>|Object} [options.mask] - Optional pose mask for [x, y, z, roll, pitch, yaw].
	* @param {Array<number>} [options.initialGuess] - Optional 5-element joint seed in radians.
 * @param {number} [options.maxIterations=20] - Iteration budget.
 * @param {number} [options.tolerance=1e-6] - Convergence threshold.
 * @param {number} [options.damping=1e-2] - Damping factor for the DLS solve.
 * @param {number} [options.stepSize=1e-4] - Finite-difference step for the Jacobian.
 * @returns {Object|null} Joint solution { q1, q2, q3, q4, q5 } plus metadata.
 */
export const calculateInverseKinematicsMatrix = (targetMatrix, options = {}) => {
	if (
		!Array.isArray(targetMatrix) ||
		targetMatrix.length < 3 ||
		!Array.isArray(targetMatrix[0]) ||
		!Array.isArray(targetMatrix[1]) ||
		!Array.isArray(targetMatrix[2])
	) {
		return null;
	}

	const {
		mask = null,
		initialGuess = null,
		maxIterations = 20,
		tolerance = 1e-3,
		damping = 1e-2,
		stepSize = 1e-4,
	} = options;

	const poseMask = normalizePoseMask(mask);

	// Build a list of candidate seeds to try
	const candidates = [];

	// 1. User-provided initial guess
	if (Array.isArray(initialGuess) && initialGuess.length >= 5) {
		candidates.push(wrapJointVector(initialGuess.slice(0, 5)));
	}

	// 2. Analytic guesses (elbow down + elbow up)
	const elbowDown = createInitialJointGuess(targetMatrix, { elbow: 'down' });
	if (elbowDown) candidates.push(elbowDown);

	const elbowUp = createInitialJointGuess(targetMatrix, { elbow: 'up' });
	if (elbowUp) candidates.push(elbowUp);

	// 3. Zero pose
	candidates.push([0, 0, 0, 0, 0]);

	// 4. A few random perturbations around the best analytic guess
	const baseGuess = elbowDown || elbowUp || [0, 0, 0, 0, 0];
	for (let i = 0; i < 4; i++) {
		candidates.push(baseGuess.map((q) => wrapToPi(q + (Math.random() - 0.5) * 1.0)));
	}

	// Try each candidate and keep the best converged result
	let bestResult = null;
	let bestFinalError = Infinity;

	for (const seed of candidates) {
		const joints = [...seed];

		const seedMatrix = calculateForwardKinematicsMatrix({ q1: joints[0], q2: joints[1], q3: joints[2], q4: joints[3], q5: joints[4] });
		const seedError = matrixPoseError(seedMatrix, targetMatrix);
		const seedErrorNorm = vectorNorm(activePoseRows(poseMask).map((rowIndex) => seedError[rowIndex]));
		let currentBest = seedErrorNorm;
		let iterationsUsed = 0;

		for (let iteration = 0; iteration < maxIterations; iteration += 1) {
			iterationsUsed = iteration + 1;
			const stepResult = buildMaskedLeastSquaresStep(joints, targetMatrix, poseMask, stepSize, damping);
			if (!stepResult) {
				break;
			}

			const { delta, errorNorm } = stepResult;

			if (errorNorm < currentBest) {
				currentBest = errorNorm;
			}

			if (errorNorm <= tolerance) {
				break;
			}

			for (let jointIndex = 0; jointIndex < 5; jointIndex += 1) {
				joints[jointIndex] = wrapToPi(joints[jointIndex] + delta[jointIndex]);
			}

			if (vectorNorm(delta) <= tolerance) {
				break;
			}
		}

		const finalMatrix = calculateForwardKinematicsMatrix({
			q1: joints[0],
			q2: joints[1],
			q3: joints[2],
			q4: joints[3],
			q5: joints[4],
		});
		const finalError = matrixPoseError(finalMatrix, targetMatrix);
		const finalErrorNorm = vectorNorm(activePoseRows(poseMask).map((rowIndex) => finalError[rowIndex]));

		if (Number.isFinite(finalErrorNorm) && finalErrorNorm <= tolerance && finalErrorNorm < bestFinalError) {
			bestFinalError = finalErrorNorm;
			const result = wrapJointVector(joints);
			bestResult = {
				q1: result[0],
				q2: result[1],
				q3: result[2],
				q4: result[3],
				q5: result[4],
				reachable: true,
				converged: true,
				iterations: iterationsUsed,
				errorNorm: finalErrorNorm,
				seedErrorNorm,
				bestErrorNorm: currentBest,
				mask: poseMask,
			};

			// If we already have an excellent solution, stop early
			if (finalErrorNorm <= tolerance * 0.1) {
				break;
			}
		}
	}

	return bestResult;
};

/**
 * Degrees wrapper for the inverse kinematics solver.
 *
 * @param {number[][]} targetMatrix - 4x4 homogeneous transform.
 * @param {Object} options - Solver options.
 * @returns {Object|null} Joint solution in degrees.
 */
export const calculateInverseKinematicsMatrixDegrees = (targetMatrix, options = {}) => {
	const solution = calculateInverseKinematicsMatrix(targetMatrix, options);
	if (!solution) {
		return null;
	}

	const toDeg = (rad) => rad * (180 / Math.PI);
	return {
		...solution,
		q1: toDeg(solution.q1),
		q2: toDeg(solution.q2),
		q3: toDeg(solution.q3),
		q4: toDeg(solution.q4),
		q5: toDeg(solution.q5),
	};
};

const fkApi = {
	calculateInverseKinematicsMatrix,
	calculateInverseKinematicsMatrixDegrees,
	calculateInverseKinematicsPosition,
	calculateInverseKinematicsPositionDegrees,
};

export default fkApi;