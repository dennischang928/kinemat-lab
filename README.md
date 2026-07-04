# Kinemat 
> An interactive and intuitive model for learning kinematics in robotics lives in [k.sengchon.com](http://k.sengchon.com) or [kinemat.netlify.app](http://kinemat.netlify.app); 

> Utilized by Dr. Amit Banerjee in ME457 course as an educational tool at the Pennsylvania State University Harrisuburg.

## Features:
1. A 2D Kinematic model of a 3-DoF robotic arm.
    - Visualization of the principles of forward kinematics with animation and interactive controls
    - Interactive step-by-step demonstration of the forward kinematics process in latex
    - Detailed math derivations of the transformation matrices

2. Digital Twin
    - A digital twin of the [5-DoF PhantomX Pincher Robot](https://docs.fictionlab.pl/integrations/noetic/legacy/trossen-phantomx-pincher)
    - A Real-time robot control and visualization 
      - A URDF 3D model synced with the physical robot
      - Connected to the physical robot via Serial communication (USB); No SDK needed, Plug-n-Play; 
      - Commander to control the joints of the physical robot
        - Connect; Torque On; Home; Send Joint Angles; Send End-Effector Pose; Send Trajectory (Under Development); Torque Off; Disconnect;
      - A fast numerical inverse kineamtics solver with adjustable masks (XYZ RPY) for the robot 
      - Tunable speed dial (tick per second) for robot control
      - Note: requires customized firmware on the robot
    - Good for in class demonstration and lab exercises in robotics courses


## How to use the web-app ([kinemat.netlify.app](http://kinemat.netlify.app)):
### Upon opening the web-app, you will land on the **2D Kinematic** page:
---
1. Use the sliders/input fields to control the joints of the 3-DoF robotic arm and observe the changes in the end-effector position and orientation.
<img src="images/Screenshot%202026-07-04%20at%2016.42.43.png" alt="Joint Control" width="400" />
2. Click on 1, 2, 3, 4 and Play All buttons to see the animations and math derivations of the forward kinematics process.
 <img src="images/Screenshot%202026-07-04%20at%2016.46.09.png" alt="Animation" width="400" />
3. Click on the "⚙️" button to change link lengths.
<img src="images/Screenshot%202026-07-04%20at%2016.48.48.png" alt="Settings" width="400" />


### Click on the "Digital Twin" button on the side bar to go to the **Digital Twin** page:
---
1. Connections Panel: Connect/Disconnect; Torque On/Off; Home;
   1. <img src="images/Screenshot%202026-07-04%20at%2016.57.05.png" alt="Connections Panel" width="400" />

2. Command Panel: **Send** with **Speed**; Gripper On/Off;
   1. Sync Button: most features are disabled until the robot is synced with the digital twin for safety. Sync requires a 3+ seconds to complete
   2. <img src="images/Screenshot%202026-07-04%20at%2017.05.18.png" alt="Command Panel" width="400" />
3. Joint Control: Use sliders to control the angles
4. Pose Control: 
    1. Masks tick Boxes: XYZ RPY;
    2. Because the PhantomX Pincher robot has only 4-DoF excluding the gripper, Only 4 variables are controllable at a time (e.g.: X, Y, Z, Yaw)
    3. Input fields: Input desired end-effector pose in XYZ RPY
    4. <img src="images/Screenshot%202026-07-04%20at%2017.12.36.png" alt="Pose Control" width="400" />
 