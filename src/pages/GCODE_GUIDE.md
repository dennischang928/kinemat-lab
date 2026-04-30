# G-Code Commander for PhantomX Pincher Robot Arm

## Overview

The G-Code Commander provides a fast, efficient communication protocol for controlling the PhantomX Pincher Robot Arm with simultaneous joint movement and smooth motion profiles. It replaces the simple menu-based interface with a G-code style command system similar to CNC machines.

## Key Features

1. **G-Code Style Commands** - Familiar format for users experienced with CNC machines
2. **Parallel Joint Movement** - All 5 joints move simultaneously, not sequentially
3. **S-Curve Acceleration** - Smooth acceleration and deceleration (no jerky movements)
4. **Speed Control** - Adjustable feedrate (F parameter) for precise speed control
5. **Rapid Mode** - High-speed positioning (G0) for fast movements
6. **Absolute/Relative Positioning** - Switch between coordinate systems with G90/G91

## Startup

The firmware boots directly into G-code control and prints the supported command set over the serial port.

- **Baud Rate**: 115200 (8N1)
- **Line Ending**: `\n` or `\r\n`
- **Buffer Size**: 128 characters max per command

If the board resets when the serial connection opens, wait for the startup messages to finish before sending commands.

## Command Syntax

### G0 - Rapid Positioning (Maximum Speed)
Move all joints to target positions at maximum speed (1000 units/sec)

```
G0 J1:512 J2:512 J3:512 J4:512 J5:512
```

- **J1-J5**: Joint positions (0-1023 for AX-12A servos)
- All joints move simultaneously to their target positions
- No feedrate control (always uses max speed)
- Any joint you omit keeps its current position

### G1 - Linear Move with Feedrate Control
Move all joints to target positions with controlled speed

```
G1 J1:512 J2:400 J3:600 J4:430 J5:512 F50
```

- **J1-J5**: Joint positions (0-1023)
- **F[speed]**: Feedrate/speed in units/sec (default: 100)
  - F50 = slow, smooth movement
  - F200 = fast movement
  - F1000 = maximum speed
- Any joint you omit keeps its current position

### G28 - Home All Joints
Move all joints to predefined home position

```
G28
```

Home positions (from poses.h):
- J1: 512 (center)
- J2: 376
- J3: 1000
- J4: 430
- J5: 512

The firmware reports `OK - Homing all joints at F50` when the command is accepted.

### G90 - Absolute Positioning Mode (Default)
All joint values are absolute positions

```
G90
G1 J1:512 J2:400 F100
```

### G91 - Relative Positioning Mode
All joint values are relative offsets from current position

```
G91
G1 J1:50 J2:-50 F100  (moves J1 +50, J2 -50 from current position)
```

### M17 - Tighten Servos (Torque ON)
Enable torque on all servos so the arm can hold position and move.

```
M17
```

The firmware reports `OK - Servos tightened (torque ON)` after the command is accepted.

### M18 - Relax Servos (Torque OFF)
Disable torque on all servos so the arm can be moved by hand.

```
M18
```

The firmware reports `OK - Servos relaxed (torque OFF)` after the command is accepted.

### M114 - Report Current Servo Positions
Read back the current servo positions for all joints.

```
M114
```

The firmware reports a line: `OK - J1:512 J2:512 J3:512 J4:512 J5:512`.

## Usage Examples

### Example 1: Move arm to center position (fast)
```
G0 J1:512 J2:512 J3:512 J4:512 J5:512
```

### Example 2: Slow controlled movement
```
G1 J1:512 J2:400 J3:600 J4:430 J5:512 F30
```

### Example 3: Move one joint (others stay at current position)
```
G1 J3:850 F100
```
(J3 moves to 850, other joints don't move)

### Example 4: Relative movement
```
G91
G1 J1:50 J2:50 F50
G90
```
(Move J1 and J2 each +50 units, then back to absolute mode)

### Example 5: Sequential rapid movements
```
G0 J1:512 J2:512 J3:512 J4:512 J5:512
G0 J1:600 J2:400 J3:700 J4:400 J5:512
G0 J1:512 J2:512 J3:512 J4:512 J5:512
```

## Motion Profiles

### S-Curve Acceleration

Each move automatically uses an S-curve profile for smooth motion:
- Acceleration phase: Smooth ramp up from stationary
- Cruising phase: Constant velocity at target speed
- Deceleration phase: Smooth ramp down to stop

This ensures:
- No mechanical shock or strain
- Smooth continuous motion
- Reduced servo wear
- Better power efficiency

### Duration Calculation

Movement duration is automatically calculated based on:
- Distance to travel (largest joint movement)
- Feedrate (F parameter)

Formula: `Duration = MaxDistance / Feedrate`

Example: Moving 300 units at F100 = 3000ms (3 seconds)

## Simultaneous Joint Movement

All joints move together from start to finish:
- Joint with largest distance reaches its target at the same time as others
- Other joints move proportionally slower to maintain timing
- Creates smooth coordinated motion without sequence steps

Example:
```
G1 J1:700 J2:400 J3:500 J4:400 J5:512 F100
```
If J1 has distance 188, J3 has distance -12:
- All joints start and stop at the same time
- J3 moves slower to cover its smaller distance

## Serial Communication

- **Baud Rate**: 115200 (8N1)
- **Line Ending**: \n or \r\n
- **Buffer Size**: 128 characters max per command
- **Response**: Each command returns "OK" or error message

### Response Messages

```
OK - Moving to J1:512 J2:512 J3:512 J4:512 J5:512, Speed:50, Duration:7680ms
OK - Move complete
OK - Absolute positioning mode
OK - Relative positioning mode
OK - Homing all joints at F50
OK - Servos relaxed (torque OFF)
OK - Servos tightened (torque ON)
ERR - Unknown G-code
ERR - Unknown M-code
ERR - No joint target (use J1:JPOS ... J5:JPOS)
```

## Advanced Parameters

### Acceleration Control

Default acceleration: 50 units/sec²
Can be adjusted via firmware (not yet exposed via G-code)

### Jerk Control

Default jerk: 100 units/sec³ (for S-curve smoothness)
Can be adjusted via firmware (not yet exposed via G-code)

## Servo Position Reference

The AX-12A servos use 10-bit position values (0-1023):
- 0 = -150°
- 512 = 0° (center)
- 1023 = +150°

Common positions for PhantomX Pincher:
- J1 (base): 512 = center
- J2 (shoulder): 376-650 typical range
- J3 (elbow): 200-1023 typical range
- J4 (wrist): 200-800 typical range
- J5 (gripper): 512 = open, 200 = close

## Tips & Best Practices

1. **Always home first**: Send `G28` after power-on for consistent starting position
2. **Use moderate speeds for pickup/placement**: F50-100 for precision tasks
3. **Use rapid mode for transit**: G0 to quickly move between positions
4. **Test before production**: Validate movements on a smaller area first
5. **Monitor current draw**: High feedrates with heavy loads may exceed servo limits
6. **Batch commands**: Send multiple commands separated by newlines for quick execution

### Supported Commands

- `G0` - Rapid joint move
- `G1` - Linear joint move with feedrate
- `G28` - Home all joints
- `G90` - Absolute positioning mode
- `G91` - Relative positioning mode
- `M17` - Torque on
- `M18` - Torque off
- `M114` - Report current joint positions

## Troubleshooting

### Arm moves jerkily
- Reduce feedrate (lower F value)
- Check servo voltage (should be stable)
- Verify servo IDs and wiring

### Movement seems slow
- Increase feedrate (higher F value)
- Use G0 for rapid positioning
- Check if servos are under heavy load

### Commands not working
- Check serial connection (should see "G-Code Mode Activated")
- Verify command syntax (uppercase G, J parameters with colon)
- Ensure newline at end of command
- Check serial monitor is set to 115200 baud

### Servo position off
- Send G28 to home all joints
- Check if joints are mechanically obstructed
- Verify servo calibration (center should be 512)

## Performance Metrics

- **Command Parse Time**: <10ms
- **Motion Update Frequency**: ~333Hz (3ms interval)
- **Maximum Speed**: 1000 units/sec (G0 rapid mode)
- **Smooth Interpolation**: S-curve with 60+ interpolation points per move
- **Simultaneous Joints**: All 5 joints move in parallel

## Future Enhancements

Planned features:
- Dynamic acceleration/jerk control via G-code
- Multiple position presets (G90.1, etc.)
- Program/macro recording (M codes)
- Feedback on servo errors and positions
- Real-time trajectory visualization
- Circular/arc interpolation (G2, G3)
