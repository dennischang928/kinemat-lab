import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
	Box,
	Button,
	Divider,
	FormControlLabel,
	IconButton,
	MenuItem,
	Paper,
	Stack,
	Switch,
	TextField,
	Typography,
	Slider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import FastRewindRoundedIcon from '@mui/icons-material/FastRewindRounded';
import FastForwardRoundedIcon from '@mui/icons-material/FastForwardRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { interpolateJoints, lerp, interpolateCartesianWithIK, buildCartesianInterpolationPlan } from '../helper/kinematics/linear_interpolation';

const STEP_MAX = 1023;
const DEG_PER_STEP = 0.29;
const FEEDRATE_MIN = 10;
const FEEDRATE_MAX = 1000;
const SPEED_OPTIONS = [100, 300, 500, 700, 900];
const INTERP_STEPS_MIN = 1;
const INTERP_STEPS_MAX = 100;
const INTERP_STEPS_DEFAULT = 20;
const MIN_STEP_DELAY_MS = 33; // ~30fps for smooth animation visualization
const clampFeedrate = (value) => Math.max(FEEDRATE_MIN, Math.min(FEEDRATE_MAX, value));
const angleToSteps = (deg) => Math.round(Math.max(0, Math.min(STEP_MAX, deg / DEG_PER_STEP)));
const clampInterpolationSteps = (value) => Math.max(INTERP_STEPS_MIN, Math.min(INTERP_STEPS_MAX, value));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ProgramInner = forwardRef(function PoseProgram({ currentPos, jointTargets, feedrate, setJointTargets, setFeedrate, connection, onError, hideRunButton = false, onPlanChange = null }, ref) {
	const [frames, setFrames] = useState([]);
	const [isRunning, setIsRunning] = useState(false);
	const [useLinearInterpolation, setUseLinearInterpolation] = useState(false);
	const [interpolationSteps, setInterpolationSteps] = useState(INTERP_STEPS_DEFAULT);
	const [savedInterpolation, setSavedInterpolation] = useState([]);
	const [cartesianFallback, setCartesianFallback] = useState(false);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const isPlayingRef = useRef(false);

	const togglePlayPause = () => {
		if (isRunning) {
			isPlayingRef.current = false;
			setIsRunning(false);
		} else {
			runProgram();
		}
	};

	useEffect(() => {
		setCurrentStepIndex(0);
	}, [savedInterpolation]);

	const hasFrames = useMemo(() => frames.length > 0, [frames.length]);

	const handleAddFrame = () => {
		const nextId = Date.now() + Math.floor(Math.random() * 1000);
		const nextIndex = frames.length + 1;

		setFrames((prev) => [
			...prev,
			{
				id: nextId,
				name: `T${nextIndex}`,
				delayMs: 0,
				feedrate: clampFeedrate(parseInt(feedrate, 10) || FEEDRATE_MIN),
				position: {
					x: parseFloat((currentPos?.x || 0).toFixed(4)),
					y: parseFloat((currentPos?.y || 0).toFixed(4)),
					z: parseFloat((currentPos?.z || 0).toFixed(4)),
				},
				joints: {
					J1: parseFloat((jointTargets?.J1 || 0).toFixed(3)),
					J2: parseFloat((jointTargets?.J2 || 0).toFixed(3)),
					J3: parseFloat((jointTargets?.J3 || 0).toFixed(3)),
					J4: parseFloat((jointTargets?.J4 || 0).toFixed(3)),
					J5: parseFloat((jointTargets?.J5 || 0).toFixed(3)),
				},
			},
		]);
	};

	const moveFrame = (index, direction) => {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= frames.length) return;

		setFrames((prev) => {
			const list = [...prev];
			const temp = list[index];
			list[index] = list[nextIndex];
			list[nextIndex] = temp;
			return list;
		});
	};

	const removeFrame = (id) => {
		if (isRunning) return;
		setFrames((prev) => prev.filter((frame) => frame.id !== id));
	};

	const updateFrameDelay = (id, value) => {
		const numeric = Math.max(0, parseInt(value, 10) || 0);
		setFrames((prev) => prev.map((frame) => (frame.id === id ? { ...frame, delayMs: numeric } : frame)));
	};

	// Gap editor: small minimal box between frames that expands to inline editor when clicked
	const GapEditor = ({ from }) => {
		const [editing, setEditing] = useState(false);
		const [hovered, setHovered] = useState(false);
		const [value, setValue] = useState(from?.delayMs || 0);

		useEffect(() => {
			setValue(from?.delayMs || 0);
		}, [from?.delayMs]);

		const save = () => {
			updateFrameDelay(from.id, Math.max(0, parseInt(value, 10) || 0));
			setEditing(false);
		};

		return (
			<Box
				key={`gap-${from.id}`}
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					py: 0.5,
					px: 0,
					mt: 0.5,
					width: '100%'
				}}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
			>
				{(hovered || editing || value > 0) ? (
					<Paper
						elevation={0}
						onClick={() => !editing && setEditing(true)}
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '100%',
							px: editing ? 0.5 : 1,
							py: 0.25,
							borderRadius: 1,
							border: '1px dashed rgba(0,0,0,0.08)',
							backgroundColor: editing ? '#eaf4ff' : 'transparent',
							cursor: editing ? 'default' : 'pointer',
						}}
					>
					{editing ? (
						<Stack direction="row" spacing={0.5} alignItems="center">
							<TextField
								size="small"
								type="number"
								value={value}
								onChange={(e) => setValue(Math.max(0, parseInt(e.target.value || 0, 10)))}
								inputProps={{ min: 0 }}
								sx={{ width: 64 }}
							/>
							<IconButton size="small" color="primary" onClick={save} aria-label="save-delay">
								<CheckIcon fontSize="small" />
							</IconButton>
							<IconButton color="secondary"size="small" onClick={() => { setValue(from?.delayMs || 0); setEditing(false); }} aria-label="cancel-delay">
								<CloseIcon fontSize="small" />
							</IconButton>
							<IconButton color="error" size="small" onClick={(e) => { e.stopPropagation(); updateFrameDelay(from.id, 0); setEditing(false); }} aria-label="delete-delay">
								<DeleteOutlineIcon fontSize="small" />
							</IconButton>
						</Stack>
					) : (
						<Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%', justifyContent: 'center' }}>
							{value > 0 ? (
								<Typography variant="caption" sx={{ fontWeight: 600, color: '#ff6f00' }}>
									⏱ {value}ms
								</Typography>
							) : (
								<Stack direction="row" alignItems="center" spacing={0.5}>
									<AddIcon fontSize="small" />
									<Typography variant="caption" sx={{ fontWeight: 500 }}>Add delay</Typography>
								</Stack>
							)}
						</Stack>
					)}
					</Paper>
				) : (
					<Box sx={{ width: '100%', height: 8 }} />
				)}
			</Box>
		);
	};

	const updateFrameSpeed = (id, value) => {
		const nextSpeed = clampFeedrate(parseInt(value, 10) || FEEDRATE_MIN);
		setFrames((prev) => prev.map((frame) => (frame.id === id ? { ...frame, feedrate: nextSpeed } : frame)));
	};

	const loadFrameToPose = (frame) => {
		if (!frame) return;
		setJointTargets({ ...frame.joints });
		setFeedrate(clampFeedrate(parseInt(frame.feedrate, 10) || FEEDRATE_MIN));
	};

	const buildPlaybackPlan = () => {
		if (!frames.length) return { plan: [], cartesianFallback: false };

		const interpolationSegments = clampInterpolationSteps(parseInt(interpolationSteps, 10) || INTERP_STEPS_DEFAULT);

		if (frames.length === 1 || !useLinearInterpolation) {
			// No interpolation: return frames as-is
			const plan = frames.map((frame) => ({
				joints: { ...frame.joints },
				feedrate: clampFeedrate(parseInt(frame.feedrate, 10) || FEEDRATE_MIN),
				delayMs: Math.max(0, parseInt(frame.delayMs, 10) || 0),
				source: frame.id,
				interpolated: false,
			}));
			return { plan, cartesianFallback: false };
		}

		// Build Cartesian interpolation plan with bidirectional convergence
		const result = buildCartesianInterpolationPlan(frames, interpolationSegments);

		// Clamp feedrate values in the result
		if (result && result.plan) {
			result.plan = result.plan.map((step) => ({
				...step,
				feedrate: clampFeedrate(step.feedrate),
			}));
		}

		return result;
	};

	useEffect(() => {
		const result = buildPlaybackPlan();
		setSavedInterpolation(result.plan || []);
		setCartesianFallback(Boolean(result.cartesianFallback));
		if (typeof onPlanChange === 'function') {
			onPlanChange(result.plan || [], Boolean(result.cartesianFallback));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frames, useLinearInterpolation, interpolationSteps]);

	const applyPoseStep = async (joints, frameFeedrate) => {
		setJointTargets({ ...joints });
		setFeedrate(clampFeedrate(parseInt(frameFeedrate, 10) || FEEDRATE_MIN));

		const command = `G1 J1:${angleToSteps(joints.J1)} J2:${angleToSteps(joints.J2)} J3:${angleToSteps(joints.J3)} J4:${angleToSteps(joints.J4)} J5:${angleToSteps(joints.J5)} F${clampFeedrate(frameFeedrate)}\n`;
		// console.log('[PoseProgram] Sending serial command:', command.trim());
		if (connection?.isConnected) {
			const ok = await connection.sendCommandWithTimeout(command);
			if (!ok) {
				throw new Error('No OK received during interpolated move.');
			}
		}
	};

	const handleSliderChange = (event, newValue) => {
		if (newValue !== currentStepIndex && newValue >= 0 && newValue < savedInterpolation.length) {
			setCurrentStepIndex(newValue);
			applyPoseStep(savedInterpolation[newValue].joints, savedInterpolation[newValue].feedrate).catch(e => onError(e.message));
		}
	};

	const runProgram = async () => {
		if (!hasFrames) {
			onError('Add at least one timeframe to run the pose program.');
			return;
		}

		setIsRunning(true);
		isPlayingRef.current = true;
		try {
			let playbackPlan = savedInterpolation;
			if (!playbackPlan.length) {
				const result = buildPlaybackPlan();
				playbackPlan = result.plan || [];
			}

			const startIdx = currentStepIndex >= playbackPlan.length - 1 ? 0 : currentStepIndex;

			for (let index = startIdx; index < playbackPlan.length; index += 1) {
				if (!isPlayingRef.current) break;

				setCurrentStepIndex(index);
				const step = playbackPlan[index];
				await applyPoseStep(step.joints, step.feedrate);

				// Use minimum step delay for animation visualization, or explicit delay if larger
				const stepDelay = Math.max(MIN_STEP_DELAY_MS, step.delayMs || 0);
				if (stepDelay > 0 && index < playbackPlan.length - 1) {
					await wait(stepDelay);
				}
			}
		} catch (err) {
			onError(err.message || 'Pose program failed to run.');
		} finally {
			setIsRunning(false);
			isPlayingRef.current = false;
		}
	};

	// Expose program actions via ref for parent component control
	useImperativeHandle(ref, () => ({
		addFrame: handleAddFrame,
		runProgram,
		getSavedInterpolation: () => savedInterpolation,
		setCurrentStepIndex: (idx) => setCurrentStepIndex(idx),
	}), [handleAddFrame, hasFrames, savedInterpolation]);

	const handleInterpolationStepsChange = (value) => {
		const numeric = clampInterpolationSteps(parseInt(value, 10) || INTERP_STEPS_MIN);
		setInterpolationSteps(numeric);
	};

	return (
		<Paper sx={{ p: 2 }}>
			<Stack spacing={1.5}>
				<Stack direction="row" spacing={1}
					sx={{
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<Typography variant="subtitle1">Pose Program</Typography>

					{savedInterpolation.length > 0 && (
						<Typography variant="caption" color="text.secondary">
							Prepared {savedInterpolation.length} playback steps
						</Typography>
					)}
					{useLinearInterpolation && cartesianFallback && (
						<Typography variant="caption" color="error">
							Cartesian linear interpolation failed for some segments; using joint interpolation instead.
						</Typography>
					)}
				</Stack>

				<Stack direction="row" spacing={1}>
					{!hideRunButton && (
						<Button
							size="small"
							variant="contained"
							startIcon={<PlayArrowIcon />}
							onClick={runProgram}
							disabled={!hasFrames || isRunning}
						>
							{isRunning ? 'Running...' : 'Run Program'}
						</Button>
					)}
				</Stack>
				<Stack direction="row" spacing={2} alignItems="center" sx={{ justifyContent: "space-between" }}>
					<FormControlLabel
						control={
							<Switch
								size="small"
								checked={useLinearInterpolation}
								onChange={(e) => setUseLinearInterpolation(e.target.checked)}
								disabled={isRunning}
							/>
						}
						label="Use linear interpolation"
					/>

					{useLinearInterpolation && (
						<TextField
							size="small"
							type="number"
							label="frames"
							value={interpolationSteps}
							onChange={(e) => handleInterpolationStepsChange(e.target.value)}
							inputProps={{ min: INTERP_STEPS_MIN, max: INTERP_STEPS_MAX, step: 1 }}
							// sx={{ width: 220 }}
							disabled={isRunning}
						/>
					)}
				</Stack>

				{frames.map((frame, index) => (
					<div key={`frame-wrap-${frame.id}`}>
						<Box
							key={frame.id}
							sx={{ border: '1px solid #e0e0e0', borderRadius: 1.2, p: 1.25, backgroundColor: '#fcfcfc' }}
						>
							<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<Typography variant="body2" sx={{ fontWeight: 600 }}>
									#{index + 1} {frame.name}
								</Typography>
								<Stack direction="row" spacing={0.25}>
									<IconButton
										size="small"
										onClick={() => moveFrame(index, -1)}
										disabled={isRunning || index === 0}
									>
										<ArrowUpwardIcon fontSize="small" />
									</IconButton>
									<IconButton
										size="small"
										onClick={() => moveFrame(index, 1)}
										disabled={isRunning || index === frames.length - 1}
									>
										<ArrowDownwardIcon fontSize="small" />
									</IconButton>
									<IconButton size="small" onClick={() => removeFrame(frame.id)} disabled={isRunning}>
										<DeleteOutlineIcon fontSize="small" />
									</IconButton>
								</Stack>
							</Box>

							<Divider sx={{ my: 1 }} />

							<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
								<TextField
									select
									size="small"
									label="Speed (F)"
									value={frame.feedrate}
									onChange={(e) => updateFrameSpeed(frame.id, e.target.value)}
									sx={{ width: 120 }}
									disabled={isRunning}
								>
									{SPEED_OPTIONS.map((speedValue) => (
										<MenuItem key={speedValue} value={speedValue}>
											F{speedValue}
										</MenuItem>
									))}
								</TextField>
								<Button
									size="small"
									variant="text"
									startIcon={<SaveAltIcon />}
									onClick={() => loadFrameToPose(frame)}
									disabled={isRunning}
								>
									Load
								</Button>
							</Stack>
						</Box>
						{index < frames.length - 1 && <GapEditor from={frame} />}
					</div>
				))}

				{savedInterpolation.length > 0 && (
					// <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#f0f4f8', borderRadius: 1, border: '1px solid #cfd8dc' }}>
					<Box
						sx={(theme) => ({
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							mt: -1,
							'& svg': {
								color: '#000',
								...(theme.applyStyles && theme.applyStyles('dark', {
									color: '#fff',
								})),
							},
						})}
					>
						<Slider
							valueLabelDisplay="on"
							marks
							value={currentStepIndex}
							min={0}
							max={Math.max(0, savedInterpolation.length - 1)}
							step={1}
							onChange={handleSliderChange}
							disabled={isRunning || savedInterpolation.length <= 1}
							valueLabelDisplay="auto"
							valueLabelFormat={(val) => `${val + 1} / ${savedInterpolation.length}`}
							sx={{ flex: 1, ml: 1, mr: 2 }}
						/>
					</Box>
					// </Box>
				)}
			</Stack>
		</Paper >
	);
});

ProgramInner.displayName = 'PoseProgram';

export default ProgramInner;

