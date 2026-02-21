/**
 * Forward Kinematics Calculator Plugin
 * Calculates joint positions for a 3-DOF robotic arm based on joint angles
 */

/**
 * Default link lengths (in mm)
 */
export const DEFAULT_LINK_LENGTHS = {
  L1: 40,  // Base to joint1
  L2: 70,  // Joint1 to joint2
  L3: 50,  // Joint2 to end effector
};

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  linkLengths: DEFAULT_LINK_LENGTHS,
  scale: 2,        // pixels per mm
  baseX: 0,        // base position x (relative, usually canvas center)
  baseY: 0,        // base position y (relative, usually canvas center)
};

/**
 * Calculate forward kinematics for 3-DOF arm
 * @param {Object} angles - Joint angles { theta1, theta2, theta3 } in radians
 * @param {Object} config - Configuration object (optional)
 *   @param {Object} config.linkLengths - Link lengths { L1, L2, L3 } in mm
 *   @param {number} config.scale - Scale factor (pixels per mm)
 *   @param {number} config.baseX - Base position X coordinate
 *   @param {number} config.baseY - Base position Y coordinate
 * @returns {Object} Object containing positions of all joints and end effector
 *   @returns {Object} base - Base position { x, y }
 *   @returns {Object} joint1 - First joint position { x, y }
 *   @returns {Object} joint2 - Second joint position { x, y }
 *   @returns {Object} joint3 - End effector position { x, y }
 *   @returns {Array} allJoints - Array of all joint positions [base, joint1, joint2, joint3]
 *   @returns {Object} angles - Cumulative angles at each joint { absolute1, absolute2, absolute3 }
 */
export const calculateForwardKinematics = (angles, config = {}) => {
  // Merge with defaults
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    linkLengths: {
      ...DEFAULT_CONFIG.linkLengths,
      ...(config.linkLengths || {}),
    },
  };

  const { theta1, theta2, theta3 } = angles;
  const { L1, L2, L3 } = finalConfig.linkLengths;
  const { scale, baseX, baseY } = finalConfig;

  // Base position
  const base = {
    x: baseX,
    y: baseY,
  };

  // Calculate cumulative angles (absolute angles at each joint)
  const angle1 = theta1;
  const angle2 = theta1 + theta2;
  const angle3 = theta1 + theta2 + theta3;

  // Joint 1: First link extends from base
  const joint1 = {
    x: base.x + L1 * scale * Math.cos(angle1),
    y: base.y - L1 * scale * Math.sin(angle1),
  };

  // Joint 2: Second link extends from joint1
  const joint2 = {
    x: joint1.x + L2 * scale * Math.cos(angle2),
    y: joint1.y - L2 * scale * Math.sin(angle2),
  };

  // Joint 3 (End effector): Third link extends from joint2
  const joint3 = {
    x: joint2.x + L3 * scale * Math.cos(angle3),
    y: joint2.y - L3 * scale * Math.sin(angle3),
  };

  // Calculate link lengths in canvas coordinates
  const linkLengths = {
    link1: Math.hypot(joint1.x - base.x, joint1.y - base.y),
    link2: Math.hypot(joint2.x - joint1.x, joint2.y - joint1.y),
    link3: Math.hypot(joint3.x - joint2.x, joint3.y - joint2.y),
  };

  // Calculate reach (distance from base to end effector)
  const reach = Math.hypot(joint3.x - base.x, joint3.y - base.y);

  return {
    // Individual joint positions
    base,
    joint1,
    joint2,
    joint3,
    
    // All joints as array
    allJoints: [base, joint1, joint2, joint3],
    
    // Absolute angles at each joint
    angles: {
      absolute1: angle1,
      absolute2: angle2,
      absolute3: angle3,
    },
    
    // Link information
    linkLengths,
    reach,
    
    // Configuration used for calculation
    config: finalConfig,
  };
};

/**
 * Calculate forward kinematics in degrees
 * Converts degree angles to radians, calculates FK, and returns results
 * @param {Object} angles - Joint angles { theta1, theta2, theta3 } in degrees
 * @param {Object} config - Configuration object (optional)
 * @returns {Object} Same as calculateForwardKinematics
 */
export const calculateForwardKinematicsDegrees = (angles, config = {}) => {
  return calculateForwardKinematics(
    {
      theta1: (angles.theta1 || 0) * (Math.PI / 180),
      theta2: (angles.theta2 || 0) * (Math.PI / 180),
      theta3: (angles.theta3 || 0) * (Math.PI / 180),
    },
    config
  );
};

/**
 * Get projected positions for a joint (horizontal and vertical projections)
 * Useful for drawing dashed projection lines
 * @param {Object} fromPosition - Starting position { x, y }
 * @param {Object} toPosition - Ending position { x, y }
 * @returns {Object} Projections with horizontal and vertical endpoints
 */
export const getProjections = (fromPosition, toPosition) => {
  return {
    horizontal: {
      start: fromPosition,
      end: { x: toPosition.x, y: fromPosition.y },
    },
    vertical: {
      start: { x: toPosition.x, y: fromPosition.y },
      end: toPosition,
    },
  };
};

/**
 * Calculate distance between two points
 * @param {Object} point1 - { x, y }
 * @param {Object} point2 - { x, y }
 * @returns {number} Euclidean distance
 */
export const distance = (point1, point2) => {
  return Math.hypot(point2.x - point1.x, point2.y - point1.y);
};

/**
 * Calculate angle from point1 to point2 in radians
 * @param {Object} point1 - { x, y }
 * @param {Object} point2 - { x, y }
 * @returns {number} Angle in radians (0 = right, π/2 = down, -π/2 = up)
 */
export const getAngle = (point1, point2) => {
  return Math.atan2(point1.y - point2.y, point2.x - point1.x);
};

export default {
  calculateForwardKinematics,
  calculateForwardKinematicsDegrees,
  getProjections,
  distance,
  getAngle,
  DEFAULT_LINK_LENGTHS,
  DEFAULT_CONFIG,
};
