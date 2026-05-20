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

const isValidTargetMatrix = (targetMatrix) => (
	Array.isArray(targetMatrix)
	&& targetMatrix.length >= 3
	&& Array.isArray(targetMatrix[0])
	&& Array.isArray(targetMatrix[1])
	&& Array.isArray(targetMatrix[2])
);

const getPoseComponents = (targetMatrix) => ({
	x: targetMatrix?.[0]?.[3] ?? 0,
	y: targetMatrix?.[1]?.[3] ?? 0,
	z: targetMatrix?.[2]?.[3] ?? 0,
	r13: targetMatrix?.[0]?.[2] ?? 0,
	r23: targetMatrix?.[1]?.[2] ?? 0,
	r33: targetMatrix?.[2]?.[2] ?? 0,
});

const recoverQ1AndQ234 = (targetMatrix) => {
	const { x, y, r13, r23, r33 } = getPoseComponents(targetMatrix);
	const q1 = Math.atan2(y, x);
	const c234 = -(r13 * Math.cos(q1) + r23 * Math.sin(q1));
	const q234 = Math.atan2(r33, c234);
	return { q1, q234 };
};

const solvePlanarTriangle = (xPlane, zPlane, elbow = 'up') => {
	const denom = 2 * UPPER_ARM * FOREARM;
	const D = (xPlane * xPlane + zPlane * zPlane - UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (denom || EPSILON);

	if (D < -1 - 1e-9 || D > 1 + 1e-9) {
		return null;
	}

	const clippedD = clamp(D, -1, 1);
	const q3Sign = elbow === 'up' ? -1 : 1;
	const q3 = Math.atan2(q3Sign * Math.sqrt(Math.max(0, 1 - clippedD * clippedD)), clippedD);
	const q2 = Math.atan2(xPlane, zPlane) - Math.atan2(FOREARM * Math.sin(q3), UPPER_ARM + FOREARM * Math.cos(q3));

	return { q2, q3, D: clippedD };
};

/**
 * Symbolic inverse kinematics for the 4-DOF arm.
 *
 * Returns the closed-form solution using:
 * q1 = atan2(y, x)
 * q234 = q2 + q3 + q4 from the rotation matrix
 * q2, q3 from the planar triangle after subtracting the wrist link
 * q4 = q234 - q2 - q3
 */
export const calculateInverseKinematicsMatrix = (targetMatrix, options = {}) => {
	if (!isValidTargetMatrix(targetMatrix)) {
		return null;
	}

	const { elbow = 'up', q5 = 0 } = options;
	const { x, y, z } = getPoseComponents(targetMatrix);
	const { q1, q234 } = recoverQ1AndQ234(targetMatrix);

	const radial = Math.hypot(x, y);
	const xPlane = radial - WRIST * Math.sin(q234);
	const zPlane = z - BASE_HEIGHT - WRIST * Math.cos(q234);

	const triangle = solvePlanarTriangle(xPlane, zPlane, elbow);
	if (!triangle) {
		return null;
	}

	const q2 = triangle.q2;
	const q3 = triangle.q3;
	const q4 = q234 - q2 - q3;

	return {
		q1: wrapToPi(q1),
		q2: wrapToPi(q2),
		q3: wrapToPi(q3),
		q4: wrapToPi(q4),
		q5: wrapToPi(q5),
		reachable: true,
		converged: true,
		method: 'symbolic-closed-form',
		elbow,
		q234,
		D: triangle.D,
	};
};

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

export const calculateInverseKinematicsMatrixSymbolic = calculateInverseKinematicsMatrix;
export const calculateInverseKinematicsMatrixSymbolicDegrees = calculateInverseKinematicsMatrixDegrees;

export const calculateInverseKinematicsPositionSymbolic = (x, y, z, options = {}) => {
	const { q234 = 0, elbow = 'up', q5 = 0 } = options;
	const q1 = Math.atan2(y, x);
	const radial = Math.hypot(x, y);
	const xPlane = radial - WRIST * Math.sin(q234);
	const zPlane = z - BASE_HEIGHT - WRIST * Math.cos(q234);

	const triangle = solvePlanarTriangle(xPlane, zPlane, elbow);
	if (!triangle) {
		return null;
	}

	const q2 = triangle.q2;
	const q3 = triangle.q3;
	const q4 = q234 - q2 - q3;

	return {
		q1: wrapToPi(q1),
		q2: wrapToPi(q2),
		q3: wrapToPi(q3),
		q4: wrapToPi(q4),
		q5: wrapToPi(q5),
		reachable: true,
		converged: true,
		method: 'symbolic-position',
		q234,
		D: triangle.D,
	};
};

export const calculateInverseKinematicsPositionSymbolicDegrees = (x, y, z, options = {}) => {
	const solution = calculateInverseKinematicsPositionSymbolic(x, y, z, options);
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

const symbolicApi = {
	calculateInverseKinematicsMatrixSymbolic,
	calculateInverseKinematicsMatrixSymbolicDegrees,
	calculateInverseKinematicsPositionSymbolic,
	calculateInverseKinematicsPositionSymbolicDegrees,
};

export default symbolicApi;
