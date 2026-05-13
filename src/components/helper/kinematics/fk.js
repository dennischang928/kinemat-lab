/**
 * Compute 5-DOF forward kinematics homogeneous transform.
 * Angles are in radians.
 *
 * @param {Object} joints - Joint angles { q1, q2, q3, q4, q5 }
 * @returns {number[][]} 4x4 transform matrix T
 */
export const calculateForwardKinematicsMatrix = ({ q1 = 0, q2 = 0, q3 = 0, q4 = 0, q5 = 0 } = {}) => {
	const s1 = Math.sin(q1);
	const c1 = Math.cos(q1);
	const s5 = Math.sin(q5);
	const c5 = Math.cos(q5);

	const q234 = q2 + q3 + q4;
	const s234 = Math.sin(q234);
	const c234 = Math.cos(q234);

	const c2 = Math.cos(q2);
	const s2 = Math.sin(q2);
	const c23 = Math.cos(q2 + q3);
	const s23 = Math.sin(q2 + q3);

	const planarOffset = 0.106 * s2 + 0.106 * s23 + 0.0645 * s234;
	const verticalOffset = 0.106 * c2 + 0.106 * c23 + 0.0645 * c234 + 0.0605;

	return [
		[-s1 * s5 + s234 * c1 * c5, -s1 * c5 - s5 * s234 * c1, -c1 * c234, planarOffset * c1],
		[s1 * s234 * c5 + s5 * c1, -s1 * s5 * s234 + c1 * c5, -s1 * c234, planarOffset * s1],
		[c5 * c234, -s5 * c234, s234, verticalOffset],
		[0, 0, 0, 1],
	];
};

/**
 * Same FK matrix but takes degrees as input.
 *
 * @param {Object} jointsDeg - Joint angles { q1, q2, q3, q4, q5 } in degrees
 * @returns {number[][]} 4x4 transform matrix T
 */
export const calculateForwardKinematicsMatrixDegrees = ({
	q1 = 0,
	q2 = 0,
	q3 = 0,
	q4 = 0,
	q5 = 0,
} = {}) => {
	const toRad = (deg) => deg * (Math.PI / 180);
	return calculateForwardKinematicsMatrix({
		q1: toRad(q1),
		q2: toRad(q2),
		q3: toRad(q3),
		q4: toRad(q4),
		q5: toRad(q5),
	});
};

const fkApi = {
	calculateForwardKinematicsMatrix,
	calculateForwardKinematicsMatrixDegrees,
};

export default fkApi;
