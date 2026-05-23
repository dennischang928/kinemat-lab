import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Paper, Stack } from '@mui/material';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { XacroParser } from 'xacro-parser';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import useKinematics from './hooks/useKinematics';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CAMERA = [6, 6, 6];
const PINCHER_PACKAGE = 'pincher_arm_description';
const PINCHER_ENTRY_XACRO = `urdf/pincher_arm.urdf.xacro`;

/** Servo degree range used to center joint angles. 296.67° total, mid = 148.335° */
const JOINT_DEGREE_CENTER = 148.335;

/** Rotation that converts FK (Z-up / ROS) coordinates to Three.js (Y-up) scene space. */
const FK_TO_SCENE_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

/** Webpack require.context for all bundled pincher-arm description assets. */
const pincherDescriptionContext = require.context(
  './pincher_arm_description',
  true,
  /\.(xacro|urdf|stl|dae)$/i,
);

// ─────────────────────────────────────────────────────────────────────────────
// Path / URL utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a file path: forward-slashes only, strip leading "./" or "/", lowercase. */
const normalizePath = (value = '') =>
  value.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();

/** Replace Python-style `**` power operator with `^` so XacroParser can evaluate it. */
const normalizeXacroMath = (text = '') => text.replace(/\*\*/g, '^');

/**
 * Build a Map from every possible alias of a bundled asset to its webpack URL.
 * Keys include:
 *  - relative path  (e.g. "meshes/base.stl")
 *  - package-prefixed  (e.g. "pincher_arm_description/meshes/base.stl")
 *  - package:// URI  (e.g. "package://pincher_arm_description/meshes/base.stl")
 *  - bare basename  (e.g. "base.stl") — only the first match wins
 */
const buildBundledPackageMap = () => {
  const fileMap = new Map();

  pincherDescriptionContext.keys().forEach((key) => {
    const assetUrl = pincherDescriptionContext(key);
    const relativePath = normalizePath(key.replace(/^\.\//, ''));
    const basename = relativePath.split('/').pop();

    fileMap.set(relativePath, assetUrl);
    fileMap.set(`${PINCHER_PACKAGE}/${relativePath}`, assetUrl);
    fileMap.set(`package://${PINCHER_PACKAGE}/${relativePath}`, assetUrl);

    // Only register the basename shortcut if it hasn't been taken yet.
    if (basename && !fileMap.has(basename)) {
      fileMap.set(basename, assetUrl);
    }
  });

  return fileMap;
};

/**
 * Resolve a mesh URL (possibly a `package://` URI or a relative path) to
 * its webpack-bundled URL. Falls back to the original string if nothing matches.
 */
const resolveMeshUrl = (pathToModel, fileMap) => {
  if (!pathToModel || !fileMap) return pathToModel;

  // Already an absolute / data / blob URL — use as-is.
  if (/^(blob:|data:|https?:)/i.test(pathToModel)) return pathToModel;

  const cleanPath = normalizePath(decodeURIComponent(pathToModel.split('?')[0]));
  const candidates = [cleanPath];

  // Expand package:// URIs into additional lookup candidates.
  if (cleanPath.startsWith('package://')) {
    const packageRelative = cleanPath.slice('package://'.length);
    const packageSplit = packageRelative.split('/');
    candidates.push(packageRelative);
    if (packageSplit.length > 1) {
      candidates.push(packageSplit.slice(1).join('/'));
    }
  }

  // Also try the bare filename.
  const cleanSplit = cleanPath.split('/');
  candidates.push(cleanSplit[cleanSplit.length - 1]);

  for (const candidate of candidates) {
    if (candidate && fileMap.has(candidate)) {
      return fileMap.get(candidate);
    }
  }

  return pathToModel;
};

// ─────────────────────────────────────────────────────────────────────────────
// FK / Pose utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a 4×4 FK matrix (ROS/Z-up) into a Three.js scene pose (Y-up).
 * Returns `{ position: [x, y, z], quaternion: THREE.Quaternion }`.
 */
const buildScenePoseFromFkMatrix = (fkMatrixValues) => {
  const fkMatrix = new THREE.Matrix4().set(
    fkMatrixValues[0][0], fkMatrixValues[0][1], fkMatrixValues[0][2], fkMatrixValues[0][3],
    fkMatrixValues[1][0], fkMatrixValues[1][1], fkMatrixValues[1][2], fkMatrixValues[1][3],
    fkMatrixValues[2][0], fkMatrixValues[2][1], fkMatrixValues[2][2], fkMatrixValues[2][3],
    fkMatrixValues[3][0], fkMatrixValues[3][1], fkMatrixValues[3][2], fkMatrixValues[3][3],
  );

  // Apply coordinate-frame rotation (Z-up → Y-up).
  const sceneMatrix = new THREE.Matrix4().multiplyMatrices(FK_TO_SCENE_ROTATION, fkMatrix);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  sceneMatrix.decompose(position, quaternion, scale);

  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');

  return {
    position: position.toArray(),
    rotation: [euler.x, euler.y, euler.z],
    quaternion,
  };
};

/**
 * Sample the world-space position and orientation of a mesh.
 * Returns coordinates remapped from Three.js (Y-up) to ROS (Z-up):
 *   { position: { x, y, z }, quaternion }
 */
const readMeshWorldPose = (mesh) => {
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();

  if (mesh) {
    mesh.getWorldPosition(worldPos);
    mesh.getWorldQuaternion(worldQuat);
  }

  return {
    // Remap Y-up → Z-up: scene Y becomes ROS Z, scene -Z becomes ROS Y.
    position: { x: worldPos.x, y: -worldPos.z, z: worldPos.y },
    quaternion: worldQuat,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared handle geometry rendered inside both TransformControls (translate & rotate).
 * A small pink shaft + red cone that indicates the end-effector direction.
 */
const TransformHandle = ({ meshRef, transformedPosition, transformedRotation }) => (
  // <group ref={meshRef} worldMatrix={matrix} matrixWorldNeedsUpdate={true}>
  // <group ref={meshRef} position=[matrix.position[0], matrix.position[1], matrix.position[2]]>
  <group ref={meshRef} position={transformedPosition} rotation={transformedRotation}>
    {/* Shaft */}
    <mesh position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.004, 0.004, 0.04, 12]} />
      <meshStandardMaterial color="#ff00ff" emissive="#7a007a" emissiveIntensity={0.35} />
    </mesh>
    {/* Arrowhead */}
    <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <coneGeometry args={[0.008, -0.02, 12]} />
      <meshStandardMaterial color="#ff1744" emissive="#7a0016" emissiveIntensity={0.4} />
    </mesh>
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// SceneContent — Three.js scene graph (runs inside <Canvas>)
// ─────────────────────────────────────────────────────────────────────────────

function SceneContent({
  robot,
  jointTargets,
  setJointTargets,
  showGrid,
  showAxes,
  controlsRef,
  showTransformControls,
  transformControlsSpace = 'local',
  transformedPosition,
  transformedRotation,
  interpolationPlan = [],
  onWaypointClick,
  onSceneTransformation,
  kinematicMask = { x: true, y: true, z: true, roll: true, pitch: true, yaw: true },
}) {
  const { getPositionFromJoints } = useKinematics();
  const { camera, invalidate } = useThree();

  // Refs for the invisible handle meshes used by TransformControls.
  // Use separate refs so translate can sample position from one mesh
  // while rotate samples orientation from the other.
  const meshRef = useRef();
  const meshRefRot = useRef();
  const pathGroupRef = useRef();
  const audioContextRef = useRef(null);
  const errorAudioRef = useRef(null);
  const [handleReady, setHandleReady] = useState(false);

  useEffect(() => {
    if (meshRef.current && !handleReady) {
      setHandleReady(true);
    }
  }, [handleReady, transformedPosition, transformedRotation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = new Audio('/sounds/mac-error.wav');
    audio.preload = 'auto';
    errorAudioRef.current = audio;
  }, []);

  // ── Transform onChange handlers ────────────────────────────────────────────
  //  Defined here (near the top of the component) so they are easy to locate
  //  and the JSX below stays clean.

  /**
   * Play a short, macOS-style error beep using Web Audio.
   * This avoids shipping a bundled sound asset while still giving clear feedback.
   */
  const playMacErrorBeep = () => {
    if (typeof window === 'undefined') return;

    if (errorAudioRef.current) {
      errorAudioRef.current.currentTime = 0;
      const playbackPromise = errorAudioRef.current.play();
      if (playbackPromise && typeof playbackPromise.then === 'function') {
        playbackPromise.catch(() => {
          // Fall through to synthesized beep if autoplay playback is blocked.
        });
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    const oscA = context.createOscillator();
    oscA.type = 'triangle';
    oscA.frequency.setValueAtTime(880, now);
    oscA.connect(gain);
    oscA.start(now);
    oscA.stop(now + 0.11);

    const oscB = context.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(660, now + 0.11);
    oscB.connect(gain);
    oscB.start(now + 0.11);
    oscB.stop(now + 0.22);
  };

  /**
   * Generic mouseUp handler for any TransformControls widget.
   * Enables/disables OrbitControls while dragging, then calls `onComplete`
   * with the current world pose once the drag ends.
   *
   * @param {object} event      - drei TransformControls mouseUp event ({ value: boolean })
   * @param {Function} onComplete - callback invoked with the world pose when drag ends
   */
  const handleTransformControlMouseUp = (event, meshRef, onComplete) => {
    // Freeze orbit-camera while the user is dragging a transform handle.
    if (controlsRef.current) {
      controlsRef.current.enabled = !event.value;
    }
    if (!event.value && typeof onComplete === 'function') {
      const result = onComplete(readMeshWorldPose(meshRef?.current)); // true if solved
      if (result === false) {
        playMacErrorBeep();
        meshRef.current.position.set(transformedPosition[0], transformedPosition[1], transformedPosition[2]);
        meshRef.current.rotation.set(transformedRotation[0], transformedRotation[1], transformedRotation[2]);
      }
      return result;
    }
  };

  /**
   * onChange for the translate TransformControls.
   * Extracts only the position from the world pose and forwards it upstream.
   */
  const handleMouseUp = (event) => {
    return handleTransformControlMouseUp(event, meshRef, (pose) => {
        return onSceneTransformation?.(pose);
    });
  };

  // ── Path visualisation ─────────────────────────────────────────────────────

  /** Precompute 3-D waypoint positions from the interpolation plan for path rendering. */
  const pathPoints = useMemo(() => {
    if (!Array.isArray(interpolationPlan) || interpolationPlan.length === 0) return [];
    try {
      return interpolationPlan.map((step) => {
        const joints = step?.joints || {};
        const point = getPositionFromJoints(joints);
        // Convert FK coordinate space → scene space ([x, z, -y]).
        const pt = new THREE.Vector3(point.x || 0, point.z || 0, -(point.y || 0));
        pt.joints = joints; // Attach joint snapshot for click-to-seek.
        return pt;
      });
    } catch {
      return [];
    }
  }, [interpolationPlan, getPositionFromJoints]);

  // ── Camera auto-fit ────────────────────────────────────────────────────────

  /** Fit the camera to the loaded robot's bounding box whenever the robot changes. */
  useEffect(() => {
    if (!robot) return;

    const box = new THREE.Box3().setFromObject(robot);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const distance = maxDim * 1;

      camera.position.set(center.x + distance, center.y + distance * 0.8, center.z + distance);
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    }
  }, [camera, controlsRef, robot]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Scene background & lighting */}
      <color attach="background" args={['#f6f8fb']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 10, 6]} intensity={0.8} castShadow />
      <pointLight position={[-8, 4, -6]} intensity={0.25} />

      {/* Optional grid overlay */}
      {showGrid && <gridHelper args={[10, 20, '#90a4ae', '#cfd8dc']} position={[0, 0, 0]} />}

      {/* Optional world-axes labels */}
      {showAxes && (
        <>
          <axesHelper args={[0.8]} />
          <Html position={[0.3, 0, 0]} center>
            <div style={{ color: '#f44336', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>X</div>
          </Html>
          <Html position={[0, 0.3, 0]} center>
            <div style={{ color: '#43a047', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>Z</div>
          </Html>
          <Html position={[0, 0, -0.3]} center>
            <div style={{ color: '#1e88e5', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>Y</div>
          </Html>
        </>
      )}

      {/* Robot URDF mesh */}
      {robot && <primitive object={robot} />}

      {/* Interpolation path — spheres at each waypoint */}
      {pathPoints.length > 0 && (
        <group ref={pathGroupRef}>
          {pathPoints.map((p, idx) => (
            <mesh
              key={`pathpt-${idx}`}
              position={[p.x, p.y, p.z]}
              onClick={(e) => {
                e.stopPropagation();
                // Seek the robot to this joint snapshot on click.
                if (p.joints && setJointTargets) setJointTargets(p.joints);
                if (onWaypointClick) onWaypointClick(idx);
              }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
              onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'default'; }}
            >
              <sphereGeometry args={[0.0015, 10, 10]} />
              {/* Start/end waypoints are green; intermediate waypoints are pink. */}
              <meshStandardMaterial
                color={idx === 0 || idx === pathPoints.length - 1 ? '#4caf50' : '#ff4081'}
              />
            </mesh>
          ))}
        </group>
      )}

      {showTransformControls && handleReady && (
        <TransformControls
          object={meshRef.current}
          space={transformControlsSpace}
          mode="translate"
          size={1}
          showX={kinematicMask.x !== false}
          showY={kinematicMask.y !== false}
          showZ={kinematicMask.z !== false}
          onMouseUp={(e) => handleMouseUp(e)}
        />
      )}
      {showTransformControls && handleReady && (
        <TransformControls
          object={meshRef.current}
          space="local"
          mode="rotate"
          size={1}
          showX={kinematicMask.roll !== false}
          showY={kinematicMask.pitch !== false}
          showZ={kinematicMask.yaw !== false}
          onMouseUp={(e) => handleMouseUp(e)}
        />
      )}

      <TransformHandle
        meshRef={meshRef}
        transformedPosition={transformedPosition}
        transformedRotation={transformedRotation}
      />
      
      <OrbitControls
        ref={controlsRef}
        makeDefault
        
        enableDamping
        dampingFactor={0.08}
        minDistance={0.1}
        maxDistance={100}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// URDF loading utilities  (used only by URDFSceneViewport)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a xacro source path to a fetchable URL using the bundled file map.
 * Strips the `package://` prefix before falling back to a plain map lookup.
 */
const resolveXacroSourceUrl = (sourcePath, fileMap) => {
  const resolved = resolveMeshUrl(sourcePath, fileMap);
  if (resolved && resolved !== sourcePath) return resolved;

  const normalized = normalizePath(sourcePath);
  const withoutPackage = normalized.startsWith('package://')
    ? normalized.replace(/^package:\/\/[^/]+\//, '')
    : normalized;

  return fileMap.get(withoutPackage) || fileMap.get(normalized) || null;
};

/**
 * Build a URDFLoader wired to the bundled asset map.
 * Registers custom mesh loaders for STL and DAE (Collada) formats.
 */
const createUrdfLoader = (fileMap) => {
  const manager = new THREE.LoadingManager();
  // Intercept every URL the loader requests and remap to webpack bundle URL.
  manager.setURLModifier((requestedUrl) => resolveMeshUrl(requestedUrl, fileMap));

  const loader = new URDFLoader(manager);
  loader.workingPath = '';

  loader.loadMeshCb = (pathToModel, localManager, onComplete) => {
    const resolvedPath = resolveMeshUrl(pathToModel, fileMap);
    const extension = normalizePath(pathToModel).split('.').pop();

    if (extension === 'stl') {
      const stlLoader = new STLLoader(localManager);
      stlLoader.load(
        resolvedPath,
        (geometry) => {
          const material = new THREE.MeshStandardMaterial({
            color: '#b0bec5',
            metalness: 0.2,
            roughness: 0.7,
          });
          onComplete(new THREE.Mesh(geometry, material));
        },
        undefined,
        (err) => onComplete(null, err),
      );
      return;
    }

    if (extension === 'dae') {
      const colladaLoader = new ColladaLoader(localManager);
      colladaLoader.load(
        resolvedPath,
        (collada) => onComplete(collada.scene),
        undefined,
        (err) => onComplete(null, err),
      );
      return;
    }

    // Fall back to the loader's built-in handler for any other mesh type.
    if (typeof URDFLoader.defaultMeshLoader === 'function') {
      URDFLoader.defaultMeshLoader(resolvedPath, localManager, onComplete);
      return;
    }

    onComplete(null, new Error(`Unsupported mesh format for ${pathToModel}`));
  };

  return loader;
};

/**
 * Fetch, parse, and expand a xacro entry file into a URDF XML string.
 * Resolves all `<xacro:include>` references via the bundled file map.
 */
const parseXacroToUrdfText = async (entryXacroPath, fileMap) => {
  const entryUrl = resolveXacroSourceUrl(entryXacroPath, fileMap);
  if (!entryUrl) throw new Error(`Unable to locate XACRO: ${entryXacroPath}`);

  const entryText = await fetch(entryUrl).then((res) => {
    if (!res.ok) throw new Error(`Failed to load XACRO (${res.status})`);
    return res.text();
  });

  const parser = new XacroParser();
  parser.inOrder = true;
  parser.requirePrefix = true;
  parser.localProperties = true;
  parser.workingPath = `package://${PINCHER_PACKAGE}/urdf/`;
  parser.rospackCommands = { find: (pkg) => `package://${pkg}` };

  // Resolve each `<xacro:include>` to its bundled URL and return the text.
  parser.getFileContents = async (path) => {
    const includeUrl = resolveXacroSourceUrl(path, fileMap);
    if (!includeUrl) throw new Error(`Unable to resolve include: ${path}`);

    const response = await fetch(includeUrl);
    if (!response.ok) throw new Error(`Failed to fetch include: ${path}`);

    return normalizeXacroMath(await response.text());
  };

  const xmlDocument = await parser.parse(normalizeXacroMath(entryText));
  return new XMLSerializer().serializeToString(xmlDocument);
};

// ─────────────────────────────────────────────────────────────────────────────
// URDFSceneViewport — main exported component
// ─────────────────────────────────────────────────────────────────────────────

function URDFSceneViewport({
  jointTargets,
  setJointTargets,
  showTransformControls = false,
  transformControlsSpace = 'local',
  interpolationPlan = [],
  onWaypointClick,
  onTransformControlChange,
  onSceneTransformation,
  kinematicMask,
}) {
  const { getForwardMatrixFromJoints } = useKinematics();
  const controlsRef = useRef(null);

  // Build the bundled asset map once and reuse it across re-renders.
  const bundledPackageMapRef = useRef(buildBundledPackageMap());

  const [robot, setRobot] = useState(null);
  const [showGrid] = useState(true);
  const [showAxes] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Derived state ──────────────────────────────────────────────────────────

  /**
   * Recompute the end-effector pose in scene space whenever joint targets change.
   * This drives both TransformControls widgets (translate + rotate).
   */
  const transformPose = useMemo(() => {
    if (!jointTargets) {
      return { position: [0, 0, 0], rotation: [0, 0, 0], quaternion: new THREE.Quaternion() };
    }
    const fkMatrix = getForwardMatrixFromJoints(jointTargets);
    return buildScenePoseFromFkMatrix(fkMatrix);


  }, [jointTargets, getForwardMatrixFromJoints]);

  // ── Joint synchronisation ──────────────────────────────────────────────────

  /**
   * Drive the URDF robot's visual joint angles whenever `jointTargets` changes.
   * Maps J1..J5 in order to the robot's non-fixed joints, converting from the
   * servo degree range (0–296.67°, centre = 148.335°) to radians centred at 0.
   */
  useEffect(() => {
    if (!robot || !jointTargets) return;

    const activeJoints = Object.values(robot.joints || {}).filter(
      (joint) => joint?.jointType !== 'fixed',
    );

    const targetKeys = ['J1', 'J2', 'J3', 'J4', 'J5'];

    activeJoints.forEach((joint, index) => {
      if (index < targetKeys.length) {
        const degTarget = jointTargets[targetKeys[index]];
        const radTarget = (degTarget - JOINT_DEGREE_CENTER) * (Math.PI / 180);
        robot.setJointValue(joint.name, radTarget);
      }
    });
  }, [robot, jointTargets]);

  // ── Robot loading ──────────────────────────────────────────────────────────

  /**
   * Parse a URDF XML string, configure shadows, and store the robot object.
   * ROS URDF assets are Z-up; rotate the root node to stand upright in Y-up scene.
   */
  const loadRobotFromUrdfText = (urdfText, fileMap) => {
    const loader = createUrdfLoader(fileMap);
    const loadedRobot = loader.parse(urdfText);

    if (!loadedRobot) {
      setErrorMessage('Unable to parse URDF content.');
      return;
    }

    // Rotate Z-up → Y-up so the robot stands upright.
    loadedRobot.rotation.x = -Math.PI / 2;

    loadedRobot.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });

    setRobot(loadedRobot);
  };

  /**
   * Entry point: fetch, parse, and load the bundled pincher arm on first mount.
   */
  const loadBundledPincherArm = async () => {
    setErrorMessage('');
    try {
      const fileMap = bundledPackageMapRef.current;
      const urdfText = await parseXacroToUrdfText(PINCHER_ENTRY_XACRO, fileMap);
      loadRobotFromUrdfText(urdfText, fileMap);
    } catch (err) {
      setErrorMessage(`Failed to load bundled pincher arm: ${err.message}`);
    }
  };

  // Load the robot once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadBundledPincherArm(); }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: DEFAULT_CAMERA, fov: 72 }}
        gl={{ shadowMap: { type: THREE.PCFShadowMap } }}
      >
        <SceneContent
          jointTargets={jointTargets}
          setJointTargets={setJointTargets}
          robot={robot}
          showGrid={showGrid}
          showAxes={showAxes}
          controlsRef={controlsRef}
          showTransformControls={showTransformControls}
          transformControlsSpace={transformControlsSpace}
          transformedPosition={transformPose.position}
          transformedRotation={transformPose.rotation}
          interpolationPlan={interpolationPlan}
          onWaypointClick={onWaypointClick}
          onSceneTransformation={onSceneTransformation}
          kinematicMask={kinematicMask}
        />
      </Canvas>

      {/* Overlay: error messages */}
      <Stack spacing={1.2} sx={{ position: 'absolute', top: 12, left: 12, pointerEvents: 'none' }}>
        {errorMessage && (
          <Paper sx={{ p: 1.25, pointerEvents: 'auto', maxWidth: 420, bgcolor: 'rgba(255,255,255,0.92)' }}>
            <Alert severity="error">{errorMessage}</Alert>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default URDFSceneViewport;