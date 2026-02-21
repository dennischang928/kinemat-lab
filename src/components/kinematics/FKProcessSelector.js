import React, { useState } from 'react';
import { calculateForwardKinematics } from './forwardkinematics';
import './fkprocessselector.css';

/**
 * FK Process Step Selector Component
 * Shows step-by-step forward kinematics visualization with interactive step selection
 */
const FKProcessSelector = ({ angles, linkLengths = { L1: 40, L2: 70, L3: 50 }, onStepChange }) => {
  const [selectedStep, setSelectedStep] = useState(1);

  // Calculate FK with canvas center as base
  const fkResult = calculateForwardKinematics(angles, {
    linkLengths,
    scale: 2,
    baseX: 0,
    baseY: 0,
  });

  const { base, joint1, joint2, joint3, angles: cumulativeAngles } = fkResult;

  // Convert radians to degrees for display
  const toDegrees = (rad) => (rad * 180 / Math.PI).toFixed(1);

  // Define steps with positions and descriptions
  const steps = [
    {
      number: 1,
      title: 'Base Position',
      description: 'P₀ = (0, 0)',
      formula: 'Starting point at origin',
      joints: ['base'],
      details: `Base located at canvas center`,
    },
    {
      number: 2,
      title: 'Joint 1 Calculation',
      description: `Using θ₁ = ${toDegrees(angles.theta1)}°`,
      formula: 'P₁ = P₀ + L₁ × [cos(θ₁), -sin(θ₁)]',
      joints: ['base', 'joint1'],
      details: `P₁ = (${joint1.x.toFixed(1)}, ${joint1.y.toFixed(1)}) px\nLink 1 length: ${linkLengths.L1}mm`,
    },
    {
      number: 3,
      title: 'Joint 2 Calculation',
      description: `Using θ₁ + θ₂ = ${toDegrees(cumulativeAngles.absolute2)}°`,
      formula: 'P₂ = P₁ + L₂ × [cos(θ₁+θ₂), -sin(θ₁+θ₂)]',
      joints: ['base', 'joint1', 'joint2'],
      details: `P₂ = (${joint2.x.toFixed(1)}, ${joint2.y.toFixed(1)}) px\nLink 2 length: ${linkLengths.L2}mm`,
    },
    {
      number: 4,
      title: 'End Effector (Joint 3)',
      description: `Using θ₁ + θ₂ + θ₃ = ${toDegrees(cumulativeAngles.absolute3)}°`,
      formula: 'P₃ = P₂ + L₃ × [cos(θ₁+θ₂+θ₃), -sin(θ₁+θ₂+θ₃)]',
      joints: ['base', 'joint1', 'joint2', 'joint3'],
      details: `P₃ = (${joint3.x.toFixed(1)}, ${joint3.y.toFixed(1)}) px\nLink 3 length: ${linkLengths.L3}mm\nTotal Reach: ${Math.hypot(joint3.x, joint3.y).toFixed(1)} px`,
    },
    {
      number: 5,
      title: 'Play All Animations',
      description: `Animate the full sequence from base to end effector.`,
      formula: 'Sequence: Base -> J1 -> J2 -> J3',
      joints: ['base', 'joint1', 'joint2', 'joint3'],
      details: `Full forward kinematics structural sequence.`,
    },
  ];

  const currentStep = steps[selectedStep - 1];

  // Notify parent of step selection
  const handleStepSelect = (step) => {
    setSelectedStep(step);
    if (onStepChange) {
      onStepChange(step);
    }
  };

  return (
    <div className="fk-process-selector">
      <h3>Forward Kinematics Process</h3>

      {/* Step Buttons */}
      <div className="step-buttons">
        {steps.map((step) => (
          <button
            key={step.number}
            className={`step-btn ${selectedStep === step.number ? 'active' : ''}`}
            onClick={() => handleStepSelect(step.number)}
            title={step.title}
          >
            <span className="step-num">{step.number}</span>
            <span className="step-short">{step.title.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Current Step Details */}
      <div className="step-details">
        <div className="detail-header">
          <h4>{currentStep.title}</h4>
          <span className="step-badge">Step {currentStep.number}/5</span>
        </div>

        <div className="detail-content">
          <div className="formula-box">
            <strong>Formula:</strong>
            <code>{currentStep.formula}</code>
          </div>

          <div className="description-box">
            <strong>Calculation:</strong>
            <p>{currentStep.description}</p>
          </div>

          <div className="result-box">
            <strong>Result:</strong>
            <pre>{currentStep.details}</pre>
          </div>

          {/* Visual representation of joint progression */}
          <div className="joint-progression">
            <strong>Joints shown:</strong>
            <div className="joint-list">
              {currentStep.joints.map((joint, idx) => (
                <span key={joint} className={`joint-tag joint-${joint}`}>
                  {joint === 'base' ? 'Base' : `J${idx}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(selectedStep / 5) * 100}%` }}></div>
      </div>
    </div>
  );
};

export default FKProcessSelector;
