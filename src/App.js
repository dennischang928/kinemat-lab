import { useState } from 'react';
import logo from './logo.svg';
import './App.css';
import Robot2d from './components/robot/robot2d';
import Robot3d from './components/robot/Robot3d';
import JointController from './components/robot/JointController';
import FKProcessSelector from './components/kinematics/FKProcessSelector';

function App() {
  const [viewMode, setViewMode] = useState('2D'); // '2D' or '3D'

  // Joint angles (in radians)
  const [angles, setAngles] = useState({
    thetaBase: 0,
    theta1: Math.PI / 4,
    theta2: Math.PI / 6,
    theta3: -Math.PI / 3
  });

  const [selectedStep, setSelectedStep] = useState(4); // 1-4, default to show all
  const [selectedJoint, setSelectedJoint] = useState(1); // 1, 2, or 3
  const [showFrameAnimation, setShowFrameAnimation] = useState(false);

  const handleStepChange = (step) => {
    setSelectedStep(step);
    if (step === 5) {
      setSelectedJoint(0); // 0 indicates "Play All"
      setShowFrameAnimation(true);
    } else if (step > 1) {
      setSelectedJoint(step - 1);
      setShowFrameAnimation(true);
    } else {
      setShowFrameAnimation(false);
    }
  };

  const handleAngleChange = (joint, value) => {
    setAngles(prev => ({
      ...prev,
      [joint]: value
    }));
  };

  return (
    <div className="App">
      <div className="App-left">
        <JointController 
          angles={angles} 
          onAngleChange={handleAngleChange} 
          selectedJoint={selectedJoint}
          onJointChange={setSelectedJoint}
          showFrameAnimation={showFrameAnimation}
          onAnimationToggle={setShowFrameAnimation}
          viewMode={viewMode}
        />
        <FKProcessSelector 
          angles={angles} 
          linkLengths={{ L1: 40, L2: 70, L3: 50 }}
          onStepChange={handleStepChange}
        />
      </div>
      <div className="App-right">
        <div className="view-tabs">
          <button 
            className={`view-tab ${viewMode === '2D' ? 'active' : ''}`} 
            onClick={() => setViewMode('2D')}
          >
            2D View
          </button>
          <button 
            className={`view-tab ${viewMode === '3D' ? 'active' : ''}`} 
            onClick={() => setViewMode('3D')}
          >
            3D View
          </button>
        </div>
        <div className="robot-container">
          {viewMode === '2D' ? (
            <Robot2d 
              angles={angles} 
              onAngleChange={handleAngleChange} 
              selectedStep={selectedStep} 
              selectedJoint={selectedJoint}
              showFrameAnimation={showFrameAnimation}
            />
          ) : (
            <Robot3d 
              angles={angles} 
              selectedStep={selectedStep} 
              selectedJoint={selectedJoint}
              showFrameAnimation={showFrameAnimation}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
