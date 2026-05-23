import { useCallback } from 'react';
import { calculateForwardKinematicsMatrixDegrees } from '../../helper/kinematics/fk';
import { calculateInverseKinematicsMatrixDegrees } from '../../helper/kinematics/ik';
// import { calculateInverseKinematicsMatrixDegrees } from '../../helper/kinematics/ik_symbolic';
import { CENTEROFFSETDEG } from '../../../constants/robotConstants';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const DEFAULT_POSITION = { x: 0.062, y: 0, z: 0.142 };
const DEFAULT_POSE = { ...DEFAULT_POSITION, roll: 0, pitch: 0, yaw: 0 };

const toSeedRadians = (jointTargets = {}) => ([
    ((jointTargets.J1 || 0) - CENTEROFFSETDEG) * DEG_TO_RAD,
    ((jointTargets.J2 || 0) - CENTEROFFSETDEG) * DEG_TO_RAD,
    ((jointTargets.J3 || 0) - CENTEROFFSETDEG) * DEG_TO_RAD,
    ((jointTargets.J4 || 0) - CENTEROFFSETDEG) * DEG_TO_RAD,
]);

const poseToMatrix = ({ x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0 }) => {
    const r = roll * DEG_TO_RAD;
    const p = pitch * DEG_TO_RAD;
    const yRad = yaw * DEG_TO_RAD;

    const cr = Math.cos(r);
    const sr = Math.sin(r);
    const cp = Math.cos(p);
    const sp = Math.sin(p);
    const cy = Math.cos(yRad);
    const sy = Math.sin(yRad);

    return [
        [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr, x],
        [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr, y],
        [-sp, cp * sr, cp * cr, z],
        [0, 0, 0, 1],
    ];
};

const matrixToPose = (matrix) => {
    const x = matrix?.[0]?.[3] ?? 0;
    const y = matrix?.[1]?.[3] ?? 0;
    const z = matrix?.[2]?.[3] ?? 0;

    const pitch = Math.atan2(-matrix[2][0], Math.sqrt((matrix[2][1] ** 2) + (matrix[2][2] ** 2)));
    const roll = Math.atan2(matrix[2][1], matrix[2][2]);
    const yaw = Math.atan2(matrix[1][0], matrix[0][0]);
    
    return {
        x,
        y,
        z,
        roll: roll * RAD_TO_DEG,
        pitch: pitch * RAD_TO_DEG,
        yaw: yaw * RAD_TO_DEG,
    };
};

const positionToMatrix = ({ x = 0, y = 0, z = 0 }) => ([
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1],
]);

function useKinematics() {
    const getForwardMatrixFromJoints = useCallback((jointTargets) => {
        if (!jointTargets) {
            return calculateForwardKinematicsMatrixDegrees();
        }

        return calculateForwardKinematicsMatrixDegrees({
            q1: (jointTargets.J1 || 0) - CENTEROFFSETDEG,
            q2: (jointTargets.J2 || 0) - CENTEROFFSETDEG,
            q3: (jointTargets.J3 || 0) - CENTEROFFSETDEG,
            q4: (jointTargets.J4 || 0) - CENTEROFFSETDEG,
        });
    }, []);

    const getPoseFromJoints = useCallback((jointTargets) => {
        if (!jointTargets) {
            return DEFAULT_POSE;
        }

        const matrix = getForwardMatrixFromJoints(jointTargets);
        return matrixToPose(matrix);
    }, [getForwardMatrixFromJoints]);

    const getPositionFromJoints = useCallback((jointTargets) => {
        if (!jointTargets) {
            return DEFAULT_POSITION;
        }

        const matrix = getForwardMatrixFromJoints(jointTargets);
        return {
            x: matrix[0][3],
            y: matrix[1][3],
            z: matrix[2][3],
        };
    }, [getForwardMatrixFromJoints]);

    const solveJointsFromTargetMatrix = useCallback((targetMatrix, currentJoints, options = {}) => {
        const { mask = [true, true, true, false, false, false] } = options;
        const initialGuess = toSeedRadians(currentJoints);

        let solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, {
            mask,
            initialGuess,
            optimizeToGuess: initialGuess,
        });

        if (!solution || !solution.converged) {
            solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, { mask });
        }

        if (!solution || !solution.converged) {
            return null;
        }
        console.log('Inverse kinematics solution:', solution);
        return {
            J1: solution.q1 + CENTEROFFSETDEG,
            J2: solution.q2 + CENTEROFFSETDEG,
            J3: solution.q3 + CENTEROFFSETDEG,
            J4: solution.q4 + CENTEROFFSETDEG,
            converged: solution.converged,
            reachable: solution.reachable,
            iterations: solution.iterations,
            errorNorm: solution.errorNorm,
            initialGuess: solution.initialGuess,
        };
    }, []);

    const solveJointsFromPosition = useCallback((position, currentJoints, options = {}) => {
        const targetMatrix = positionToMatrix(position);
        return solveJointsFromTargetMatrix(targetMatrix, currentJoints, options);
    }, [solveJointsFromTargetMatrix]);

    const solveJointsFromPose = useCallback((pose, currentJoints, options = {}) => {
        const targetMatrix = poseToMatrix(pose);
        return solveJointsFromTargetMatrix(targetMatrix, currentJoints? currentJoints : null, options);
    }, [solveJointsFromTargetMatrix]);

    return {
        getForwardMatrixFromJoints,
        getPoseFromJoints,
        getPositionFromJoints,
        solveJointsFromTargetMatrix,
        solveJointsFromPosition,
        solveJointsFromPose,
    };
}

export default useKinematics;

