import React from 'react';
import { calculateForwardKinematics } from './forwardkinematics';
import './fkvisualizer.css';

/**
 * FK Visualizer Component
 * Displays forward kinematics calculation results and process visualization
 */
const FKVisualizer = ({ angles, linkLengths = { L1: 40, L2: 70, L3: 50 }, scale = 2 }) => {
  // Calculate FK with canvas center as base
  const fkResult = calculateForwardKinematics(angles, {
    linkLengths,
    scale,
    baseX: 0, // Relative to base
    baseY: 0,
  });

  const { base, joint1, joint2, joint3, angles: cumulativeAngles, linkLengths: calculatedLengths, reach } = fkResult;

  // Convert radians to degrees for display
  const toDegrees = (rad) => (rad * 180 / Math.PI).toFixed(2);
  const toDistance = (px) => (px / scale).toFixed(2);

  return (
    <div className="fk-visualizer">
      <div className="fk-section">
        <h4>🔗 Joint Positions (in pixels)</h4>
        <table className="fk-table">
          <thead>
            <tr>
              <th>Joint</th>
              <th>X (px)</th>
              <th>Y (px)</th>
              <th>Distance from Base (mm)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-base">
              <td>Base</td>
              <td>{base.x.toFixed(1)}</td>
              <td>{base.y.toFixed(1)}</td>
              <td>0.00</td>
            </tr>
            <tr className="row-joint1">
              <td>Joint 1</td>
              <td>{joint1.x.toFixed(1)}</td>
              <td>{joint1.y.toFixed(1)}</td>
              <td>{toDistance(calculatedLengths.link1)}</td>
            </tr>
            <tr className="row-joint2">
              <td>Joint 2</td>
              <td>{joint2.x.toFixed(1)}</td>
              <td>{joint2.y.toFixed(1)}</td>
              <td>{toDistance(Math.hypot(joint2.x - base.x, joint2.y - base.y))}</td>
            </tr>
            <tr className="row-joint3">
              <td>End Effector</td>
              <td>{joint3.x.toFixed(1)}</td>
              <td>{joint3.y.toFixed(1)}</td>
              <td>{toDistance(reach)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="fk-section">
        <h4>📐 Absolute Angles (degrees)</h4>
        <table className="fk-table">
          <thead>
            <tr>
              <th>Joint</th>
              <th>Cumulative Angle</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-angle1">
              <td>θ₁</td>
              <td>{toDegrees(cumulativeAngles.absolute1)}°</td>
              <td>Base rotation</td>
            </tr>
            <tr className="row-angle2">
              <td>θ₁ + θ₂</td>
              <td>{toDegrees(cumulativeAngles.absolute2)}°</td>
              <td>Joint 1 orientation</td>
            </tr>
            <tr className="row-angle3">
              <td>θ₁ + θ₂ + θ₃</td>
              <td>{toDegrees(cumulativeAngles.absolute3)}°</td>
              <td>End effector orientation</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="fk-section">
        <h4>📏 Link Information</h4>
        <table className="fk-table">
          <thead>
            <tr>
              <th>Link</th>
              <th>Length (mm)</th>
              <th>Rendered Length (px)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-link1">
              <td>Link 1 (Base → Joint 1)</td>
              <td>{linkLengths.L1}</td>
              <td>{calculatedLengths.link1.toFixed(1)}</td>
            </tr>
            <tr className="row-link2">
              <td>Link 2 (Joint 1 → Joint 2)</td>
              <td>{linkLengths.L2}</td>
              <td>{calculatedLengths.link2.toFixed(1)}</td>
            </tr>
            <tr className="row-link3">
              <td>Link 3 (Joint 2 → End Effector)</td>
              <td>{linkLengths.L3}</td>
              <td>{calculatedLengths.link3.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="fk-section">
        <h4>🎯 Workspace</h4>
        <div className="fk-stats">
          <div className="stat-item">
            <span className="stat-label">Total Reach:</span>
            <span className="stat-value">{toDistance(reach)} mm ({reach.toFixed(1)} px)</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Max Reach:</span>
            <span className="stat-value">{(linkLengths.L1 + linkLengths.L2 + linkLengths.L3).toFixed(2)} mm</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Min Reach:</span>
            <span className="stat-value">{Math.abs(linkLengths.L1 + linkLengths.L2 - linkLengths.L3).toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      <div className="fk-section">
        <h4>FK Process (Step-by-Step)</h4>
        <div className="fk-process">
          <div className="process-step">
            <span className="step-number">1</span>
            <div className="step-content">
              <strong>Base Position</strong>
              <p>P₀ = (0, 0)</p>
            </div>
          </div>

          <div className="process-arrow">→</div>

          <div className="process-step">
            <span className="step-number">2</span>
            <div className="step-content">
              <strong>Joint 1</strong>
              <p>Using angle θ₁ = {toDegrees(angles.theta1)}°</p>
              <p>P₁ = P₀ + L₁ × [cos(θ₁), -sin(θ₁)]</p>
              <p>P₁ = ({joint1.x.toFixed(1)}, {joint1.y.toFixed(1)})</p>
            </div>
          </div>

          <div className="process-arrow">→</div>

          <div className="process-step">
            <span className="step-number">3</span>
            <div className="step-content">
              <strong>Joint 2</strong>
              <p>Using angle θ₁ + θ₂ = {toDegrees(cumulativeAngles.absolute2)}°</p>
              <p>P₂ = P₁ + L₂ × [cos(θ₁+θ₂), -sin(θ₁+θ₂)]</p>
              <p>P₂ = ({joint2.x.toFixed(1)}, {joint2.y.toFixed(1)})</p>
            </div>
          </div>

          <div className="process-arrow">→</div>

          <div className="process-step">
            <span className="step-number">4</span>
            <div className="step-content">
              <strong>End Effector</strong>
              <p>Using angle θ₁ + θ₂ + θ₃ = {toDegrees(cumulativeAngles.absolute3)}°</p>
              <p>P₃ = P₂ + L₃ × [cos(θ₁+θ₂+θ₃), -sin(θ₁+θ₂+θ₃)]</p>
              <p>P₃ = ({joint3.x.toFixed(1)}, {joint3.y.toFixed(1)})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FKVisualizer;
    