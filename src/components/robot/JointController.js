import React from 'react';
import './jointController.css';

const JointController = ({ 
  angles, 
  onAngleChange,
  selectedJoint,
  onJointChange,
  showFrameAnimation,
  onAnimationToggle,
  viewMode
}) => {
  const handleAngleChange = (joint, value) => {
    onAngleChange(joint, value);
  };

  const handleNumberInput = (joint, degValue) => {
    const clamped = Math.max(-180, Math.min(180, degValue));
    onAngleChange(joint, clamped * Math.PI / 180);
  };

  return (
    <div className="joint-controller">
      <h3 style={{ paddingLeft: '20px' }}>Joint Controls</h3>
      <div style={{ padding: '20px', fontSize: '12px', lineHeight: '1.8' }}>
        
        <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #ccc' }}>
          <h4>Frame Animation</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label>Select Joint: </label>
            <select 
              value={selectedJoint} 
              onChange={(e) => onJointChange(Number(e.target.value))}
            >
              <option value={1}>Joint 1</option>
              <option value={2}>Joint 2</option>
              <option value={3}>Joint 3</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input 
                type="checkbox" 
                checked={showFrameAnimation} 
                onChange={(e) => onAnimationToggle(e.target.checked)}
              />
              Show Frame Animation
            </label>
          </div>
        </div>

        {viewMode === '3D' && (
          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #ccc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>θ0:</label>
            <input
              type="number"
              min="-180"
              max="180"
              step="1"
              value={Math.round(angles.thetaBase * 180 / Math.PI)}
              onChange={(e) => handleNumberInput('thetaBase', parseFloat(e.target.value) || 0)}
              style={{ width: '60px', textAlign: 'center' }}
            />
            <span>°</span>
          </div>
            <input
              type="range"
              min="-180"
              max="180"
              value={angles.thetaBase * 180 / Math.PI}
              onChange={(e) => handleAngleChange('thetaBase', parseFloat(e.target.value) * Math.PI / 180)}
              style={{ width: '90%' }}
            />
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>θ1:</label>
            <input
              type="number"
              min="-180"
              max="180"
              step="1"
              value={Math.round(angles.theta1 * 180 / Math.PI)}
              onChange={(e) => handleNumberInput('theta1', parseFloat(e.target.value) || 0)}
              style={{ width: '60px', textAlign: 'center' }}
            />
            <span>°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={angles.theta1 * 180 / Math.PI}
            onChange={(e) => handleAngleChange('theta1', parseFloat(e.target.value) * Math.PI / 180)}
            style={{ width: '90%' }}
          />
        </div>
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>θ2:</label>
            <input
              type="number"
              min="-180"
              max="180"
              step="1"
              value={Math.round(angles.theta2 * 180 / Math.PI)}
              onChange={(e) => handleNumberInput('theta2', parseFloat(e.target.value) || 0)}
              style={{ width: '60px', textAlign: 'center' }}
            />
            <span>°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={angles.theta2 * 180 / Math.PI}
            onChange={(e) => handleAngleChange('theta2', parseFloat(e.target.value) * Math.PI / 180)}
            style={{ width: '90%' }}
          />
        </div>
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>θ3:</label>
            <input
              type="number"
              min="-180"
              max="180"
              step="1"
              value={Math.round(angles.theta3 * 180 / Math.PI)}
              onChange={(e) => handleNumberInput('theta3', parseFloat(e.target.value) || 0)}
              style={{ width: '60px', textAlign: 'center' }}
            />
            <span>°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={angles.theta3 * 180 / Math.PI}
            onChange={(e) => handleAngleChange('theta3', parseFloat(e.target.value) * Math.PI / 180)}
            style={{ width: '90%' }}
          />
        </div>
      </div>
    </div>
  );
};

export default JointController;
