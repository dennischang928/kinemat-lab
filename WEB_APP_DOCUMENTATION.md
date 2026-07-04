# Kinemat Web App Documentation

## Overview

Kinemat is an interactive robotics learning app for kinematics and robot control. It combines a 2D kinematics learning experience with a digital twin for the PhantomX Pincher robot.

The app is currently hosted at:

- [k.sengchon.com](http://k.sengchon.com)
- [kinemat.netlify.app](http://kinemat.netlify.app)

## Tech Stack

This repo is a React application built with:

- React 19
- React DOM 19
- React Router
- React Scripts
- TypeScript
- Three.js
- `@react-three/fiber` and `@react-three/drei`
- URDF tooling: `urdf-loader` and `xacro-parser`
- UI and styling: Material UI, Emotion, Base UI
- Math and visualization: KaTeX, React KaTeX, Konva, React Konva, `ml-matrix`, `zustand`

## Main App Areas

The app is organized around two major experiences:

1. 2D Kinematic model
2. Digital Twin for the 5-DoF PhantomX Pincher robot

The README describes the feature set in more detail, including interactive forward kinematics, mathematical derivations, real-time robot visualization, serial communication, inverse kinematics, and joint/pose control.

## How To Clone

```bash
git clone <repository-url>
cd kinemat-lab
```

If you already have the repository locally, pull the latest changes before contributing:

```bash
git pull
```

## How To Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Build a production version:

```bash
npm run build
```

Run the test suite:

```bash
npm test
```

## How To Contribute

1. Create a new branch for your change.
2. Make the change and verify it locally.
3. Keep the app stable and preserve the existing robotics workflows.
4. Submit a pull request or share the patch for review.

## Contribution Notes

- Keep changes consistent with the existing React and robotics visualization structure.
- If you touch kinematics, robot control, or URDF-related code, verify the 2D model and digital twin still behave correctly.
- Document any user-facing changes in the README or related docs when needed.

## Contact

For any problem, contact:

- Dennis Seng Chon Chang
- Email: [dennischang928@gmail.com](mailto:dennischang928@gmail.com)

## Reference

For the current feature description and usage notes, see the root [README.md](./README.md).
