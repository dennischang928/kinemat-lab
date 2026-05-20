import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Paper, Slider, Stack, Typography } from '@mui/material';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, TransformControls, DragControls } from '@react-three/drei';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { XacroParser } from 'xacro-parser';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { calculateForwardKinematicsMatrixDegrees } from '../helper/kinematics/fk';
// import { calculateInverseKinematicsMatrixDegrees } from '../helper/kinematics/ik_symbolic';
import { calculateInverseKinematicsMatrixDegrees } from '../helper/kinematics/ik';

const DEFAULT_CAMERA = [6, 6, 6];
const PINCHER_PACKAGE = 'pincher_arm_description';
const PINCHER_ENTRY_XACRO = `urdf/pincher_arm.urdf.xacro`;

const pincherDescriptionContext = require.context('./pincher_arm_description', true, /\.(xacro|urdf|stl|dae)$/i);

const normalizePath = (value = '') => value.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
const normalizeXacroMath = (text = '') => text.replace(/\*\*/g, '^');
const FK_TO_SCENE_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

const buildBundledPackageMap = () => {
  const fileMap = new Map();
  pincherDescriptionContext.keys().forEach((key) => {
    const assetUrl = pincherDescriptionContext(key);
    const relativePath = normalizePath(key.replace(/^\.\//, ''));
    const basename = relativePath.split('/').pop();

    fileMap.set(relativePath, assetUrl);
    fileMap.set(`${PINCHER_PACKAGE}/${relativePath}`, assetUrl);
    fileMap.set(`package://${PINCHER_PACKAGE}/${relativePath}`, assetUrl);
    if (basename && !fileMap.has(basename)) {
      fileMap.set(basename, assetUrl);
    }
  });

  return fileMap;
};

const resolveMeshUrl = (pathToModel, fileMap) => {
  if (!pathToModel || !fileMap) return pathToModel;
  if (/^(blob:|data:|https?:)/i.test(pathToModel)) return pathToModel;

  const cleanPath = normalizePath(decodeURIComponent(pathToModel.split('?')[0]));
  const candidates = [cleanPath];

  if (cleanPath.startsWith('package://')) {
    const packageRelative = cleanPath.slice('package://'.length);
    const packageSplit = packageRelative.split('/');
    candidates.push(packageRelative);
    if (packageSplit.length > 1) {
      candidates.push(packageSplit.slice(1).join('/'));
    }
  }

  const cleanSplit = cleanPath.split('/');
  candidates.push(cleanSplit[cleanSplit.length - 1]);

  for (const candidate of candidates) {
    if (candidate && fileMap.has(candidate)) {
      return fileMap.get(candidate);
    }
  }

  return pathToModel;
};

const solveIKForWorldPosition = ((worldPos, currentJoints) => {
  const targetX = worldPos.x;
  const targetY = -worldPos.z;
  const targetZ = worldPos.y;

  const targetMatrix = [
    [1, 0, 0, targetX],
    [0, 1, 0, targetY],
    [0, 0, 1, targetZ],
    [0, 0, 0, 1],
  ];

  const centerOffsetDeg = 148.335;
  const seedQ1 = ((currentJoints.J1 || 0) - centerOffsetDeg) * (Math.PI / 180);
  const seedQ2 = ((currentJoints.J2 || 0) - centerOffsetDeg) * (Math.PI / 180);
  const seedQ3 = ((currentJoints.J3 || 0) - centerOffsetDeg) * (Math.PI / 180);
  const seedQ4 = ((currentJoints.J4 || 0) - centerOffsetDeg) * (Math.PI / 180);
  const seedQ5 = ((currentJoints.J5 || 0) - centerOffsetDeg) * (Math.PI / 180);

  let solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, {
    mask: [true, true, true, false, false, false],
    initialGuess: [seedQ1, seedQ2, seedQ3, seedQ4, seedQ5],
  });

  if (!solution || !solution.converged) {
    console.log("IK DLS failed, falling back to analytic guess solver...");
    solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, {
      mask: [true, true, true, false, false, false],
    });
  }

  if (solution && solution.converged) {
    return {
      J1: solution.q1 + centerOffsetDeg,
      J2: solution.q2 + centerOffsetDeg,
      J3: solution.q3 + centerOffsetDeg,
      J4: solution.q4 + centerOffsetDeg,
      J5: solution.q5 + centerOffsetDeg,
    };
  }
  return null;
})

const buildScenePoseFromJointTargets = (jointTargets) => {
  const centerOffsetDeg = 148.335;
  const fkMatrixValues = calculateForwardKinematicsMatrixDegrees({
    q1: (jointTargets.J1 || 0) - centerOffsetDeg,
    q2: (jointTargets.J2 || 0) - centerOffsetDeg,
    q3: (jointTargets.J3 || 0) - centerOffsetDeg,
    q4: (jointTargets.J4 || 0) - centerOffsetDeg,
    q5: (jointTargets.J5 || 0) - centerOffsetDeg,
  });

  const fkMatrix = new THREE.Matrix4().set(
    fkMatrixValues[0][0], fkMatrixValues[0][1], fkMatrixValues[0][2], fkMatrixValues[0][3],
    fkMatrixValues[1][0], fkMatrixValues[1][1], fkMatrixValues[1][2], fkMatrixValues[1][3],
    fkMatrixValues[2][0], fkMatrixValues[2][1], fkMatrixValues[2][2], fkMatrixValues[2][3],
    fkMatrixValues[3][0], fkMatrixValues[3][1], fkMatrixValues[3][2], fkMatrixValues[3][3],
  );

  const sceneMatrix = new THREE.Matrix4().multiplyMatrices(FK_TO_SCENE_ROTATION, fkMatrix);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  sceneMatrix.decompose(position, quaternion, scale);

  return {
    position: position.toArray(),
    quaternion,
  };
};

function SceneContent({
  robot,
  jointTargets,
  setJointTargets,
  showGrid,
  showAxes,
  controlsRef,
  showTransformControls,
  transformPosition,
  transformQuaternion,
  interpolationPlan = [],
  onWaypointClick,
}) {
  const { camera } = useThree();
  const meshRef = useRef();
  const pathGroupRef = useRef();
  const pathPoints = useMemo(() => {
    if (!Array.isArray(interpolationPlan) || interpolationPlan.length === 0) return [];
    try {
      const centerOffsetDeg = 148.335;
      return interpolationPlan.map((step) => {
        const joints = step?.joints || {};
        const T = calculateForwardKinematicsMatrixDegrees({
          q1: (joints.J1 || 0) - centerOffsetDeg,
          q2: (joints.J2 || 0) - centerOffsetDeg,
          q3: (joints.J3 || 0) - centerOffsetDeg,
          q4: (joints.J4 || 0) - centerOffsetDeg,
          q5: (joints.J5 || 0) - centerOffsetDeg,
        });

        const x = T[0][3] || 0;
        const y = T[1][3] || 0;
        const z = T[2][3] || 0;
        // Convert FK coordinate space to scene space used elsewhere ([x, z, -y])
        const pt = new THREE.Vector3(x, z, -y);
        pt.joints = joints;
        return pt;
      });
    } catch (e) {
      return [];
    }
  }, [interpolationPlan]);

  // useEffect(() => {
  //   if (pathPoints && pathPoints.length > 0) {
  //     // Debug: log number of points and first/last coordinates
  //     try {
  //       // eslint-disable-next-line no-console
  //       console.log('[URDFSceneViewport] pathPoints:', pathPoints.length, pathPoints[0]?.toArray(), pathPoints[pathPoints.length - 1]?.toArray());
  //     } catch (e) {
  //       // ignore
  //     }
  //   }
  // }, [pathPoints]);


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

  return (
    <>
      <color attach="background" args={['#f6f8fb']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 10, 6]} intensity={0.8} castShadow />
      <pointLight position={[-8, 4, -6]} intensity={0.25} />

      {showGrid && <gridHelper args={[10, 20, '#90a4ae', '#cfd8dc']} position={[0, 0, 0]} />}
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

      {robot && <primitive object={robot} />}

      {/* Interpolation path visualization */}
      {pathPoints.length > 0 && (
        <group ref={pathGroupRef}>

          {/* Small spheres at each waypoint */}
          {pathPoints.map((p, idx) => (
            <mesh
              key={`pathpt-${idx}`}
              position={[p.x, p.y, p.z]}
              onClick={(e) => {
                e.stopPropagation();
                if (p.joints && setJointTargets) {
                  setJointTargets(p.joints);
                }
                if (onWaypointClick) {
                  onWaypointClick(idx);
                }
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'default';
              }}
            >
              <sphereGeometry args={[0.0015, 10, 10]} />
              <meshStandardMaterial color={idx === 0 || idx === pathPoints.length - 1 ? '#4caf50' : '#ff4081'} />
            </mesh>
          ))}
        </group>
      )}

      {showTransformControls && (
        <TransformControls
          mode="translate"
          position={transformPosition}
          size={0.5}
          onMouseUp={(e) => {
            if (controlsRef.current) {
              controlsRef.current.enabled = !e.value;
            }
            if (!e.value && setJointTargets) {
              const mesh = meshRef.current;
              const worldPos = new THREE.Vector3();
              if (mesh) {
                mesh.getWorldPosition(worldPos);
              }

              const newJoints = solveIKForWorldPosition(worldPos, jointTargets);
              if (newJoints) {
                setJointTargets(newJoints);
              }
            }
          }}
        >
          <group ref={meshRef} quaternion={transformQuaternion}>
            <mesh position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.004, 0.004, 0.04, 12]} />
              <meshStandardMaterial color="#ff00ff" emissive="#7a007a" emissiveIntensity={0.35} />
            </mesh>
            <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.008, -0.02, 12]} />
              <meshStandardMaterial color="#ff1744" emissive="#7a0016" emissiveIntensity={0.4} />
            </mesh>
            {/* <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.007, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} />
            </mesh> */}
          </group>
        </TransformControls>
      )}
      {showTransformControls && (<TransformControls
        mode="rotate"
        position={transformPosition}
        size={0.6}
      >
      </TransformControls>)}

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

function URDFSceneViewport({ jointTargets, setJointTargets, showTransformControls = false, interpolationPlan = [], onWaypointClick }) {
  const controlsRef = useRef(null);
  const bundledPackageMapRef = useRef(buildBundledPackageMap());

  const [robot, setRobot] = useState(null);
  const [showGrid] = useState(true);
  const [showAxes] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const transformPose = useMemo(() => {
    if (!jointTargets) {
      return {
        position: [0, 0, 0],
        quaternion: new THREE.Quaternion(),
      };
    }
    return buildScenePoseFromJointTargets(jointTargets);
  }, [jointTargets]);

  const hasRobot = useMemo(() => Boolean(robot), [robot]);

  const createUrdfLoader = (fileMap) => {
    const manager = new THREE.LoadingManager();
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
            const material = new THREE.MeshStandardMaterial({ color: '#b0bec5', metalness: 0.2, roughness: 0.7 });
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

      if (typeof URDFLoader.defaultMeshLoader === 'function') {
        URDFLoader.defaultMeshLoader(resolvedPath, localManager, onComplete);
        return;
      }

      onComplete(null, new Error(`Unsupported mesh format for ${pathToModel}`));
    };

    return loader;
  };

  const loadRobotFromUrdfText = (urdfText, fileMap, label) => {
    const loader = createUrdfLoader(fileMap);
    const loadedRobot = loader.parse(urdfText);
    if (!loadedRobot) {
      setErrorMessage('Unable to parse URDF content.');
      return;
    }

    // Most ROS URDF assets are authored Z-up; Three.js is Y-up.
    // Rotate once so the robot stands upright in this viewport.
    loadedRobot.rotation.x = -Math.PI / 2;

    loadedRobot.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });

    setRobot(loadedRobot);
  };

  useEffect(() => {
    if (!robot || !jointTargets) return;

    // Retrieve non-fixed joints from the loaded robot
    const activeJoints = Object.values(robot.joints || {}).filter((joint) => joint?.jointType !== 'fixed');

    // Map J1..J5 in sequence to the active joints.
    const targetKeys = ['J1', 'J2', 'J3', 'J4', 'J5'];

    // ANGLE_MAX from ControlPanel is ~296.67. Center is roughly 148.335 degrees.
    // Convert target degree to radians where 148.335 deg = 0 rad.
    activeJoints.forEach((joint, index) => {
      if (index < targetKeys.length) {
        const degTarget = jointTargets[targetKeys[index]];
        // Shift base 148.335 deg to 0, then to radians
        const radTarget = (degTarget - 148.335) * (Math.PI / 180);
        robot.setJointValue(joint.name, radTarget);
      }
    });
  }, [robot, jointTargets]);

  const resolveXacroSourceUrl = (sourcePath, fileMap) => {
    const resolved = resolveMeshUrl(sourcePath, fileMap);
    if (resolved && resolved !== sourcePath) {
      return resolved;
    }

    const normalized = normalizePath(sourcePath);
    const withoutPackage = normalized.startsWith('package://')
      ? normalized.replace(/^package:\/\/[^/]+\//, '')
      : normalized;

    return fileMap.get(withoutPackage) || fileMap.get(normalized) || null;
  };

  const parseXacroToUrdfText = async (entryXacroPath, fileMap) => {
    const entryUrl = resolveXacroSourceUrl(entryXacroPath, fileMap);
    if (!entryUrl) {
      throw new Error(`Unable to locate XACRO: ${entryXacroPath}`);
    }

    const entryText = await fetch(entryUrl).then((res) => {
      if (!res.ok) throw new Error(`Failed to load XACRO (${res.status})`);
      return res.text();
    });

    const parser = new XacroParser();
    parser.inOrder = true;
    parser.requirePrefix = true;
    parser.localProperties = true;
    parser.workingPath = `package://${PINCHER_PACKAGE}/urdf/`;
    parser.rospackCommands = {
      find: (pkg) => `package://${pkg}`,
    };
    parser.getFileContents = async (path) => {
      const includeUrl = resolveXacroSourceUrl(path, fileMap);
      if (!includeUrl) {
        throw new Error(`Unable to resolve include: ${path}`);
      }

      const response = await fetch(includeUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch include: ${path}`);
      }

      const includeText = await response.text();
      return normalizeXacroMath(includeText);
    };

    const xmlDocument = await parser.parse(normalizeXacroMath(entryText));
    return new XMLSerializer().serializeToString(xmlDocument);
  };

  const loadBundledPincherArm = async () => {
    setErrorMessage('');
    try {
      const fileMap = bundledPackageMapRef.current;
      const urdfText = await parseXacroToUrdfText(PINCHER_ENTRY_XACRO, fileMap);
      loadRobotFromUrdfText(urdfText, fileMap, `${PINCHER_PACKAGE} (xacro)`);
    } catch (err) {
      setErrorMessage(`Failed to load bundled pincher arm: ${err.message}`);
    }
  };

  useEffect(() => {
    loadBundledPincherArm();
    // Run once on mount to preload the bundled pincher package.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



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
          transformPosition={transformPose.position}
          transformQuaternion={transformPose.quaternion}
          interpolationPlan={interpolationPlan}
          onWaypointClick={onWaypointClick}
        />
      </Canvas>

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