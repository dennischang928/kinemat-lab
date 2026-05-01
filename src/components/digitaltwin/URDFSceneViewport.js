import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Paper, Slider, Stack, Typography } from '@mui/material';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { XacroParser } from 'xacro-parser';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

const DEFAULT_CAMERA = [2.5, 2.5, 2.5];
const PINCHER_PACKAGE = 'pincher_arm_description';
const PINCHER_ENTRY_XACRO = `urdf/pincher_arm.urdf.xacro`;

const pincherDescriptionContext = require.context('./pincher_arm_description', true, /\.(xacro|urdf|stl|dae)$/i);

const normalizePath = (value = '') => value.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
const normalizeXacroMath = (text = '') => text.replace(/\*\*/g, '^');

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

function SceneContent({ robot, showGrid, showAxes, controlsRef }) {
  const { camera } = useThree();

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
      {showAxes && <axesHelper args={[0.8]} />}

      {robot && <primitive object={robot} />}

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

function URDFSceneViewport({ jointTargets }) {
  const controlsRef = useRef(null);
  const bundledPackageMapRef = useRef(buildBundledPackageMap());

  const [robot, setRobot] = useState(null);
  const [showGrid] = useState(true);
  const [showAxes] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
      <Canvas shadows camera={{ position: DEFAULT_CAMERA, fov: 50 }}>
        <SceneContent robot={robot} showGrid={showGrid} showAxes={showAxes} controlsRef={controlsRef} />
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