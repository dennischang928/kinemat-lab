import { useState } from 'react';
import { Box } from '@mui/material';
import MainSidebar from '../components/common/MainSidebar';
import KinematicsView from '../components/views/KinematicsView';
import DigitalTwinView from '../components/views/DigitalTwinView';

function MainPage() {
  const [activeView, setActiveView] = useState('kinematics');
  const [digitalTwinSection, setDigitalTwinSection] = useState('control');

  const renderContent = () => {
    switch (activeView) {
      case 'kinematics':
        return <KinematicsView />;
      case 'digitaltwin':
        return <DigitalTwinView activeSection={digitalTwinSection} onSectionChange={setDigitalTwinSection} />;
      default:
        return <KinematicsView />;
    }
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Main Sidebar */}
      <MainSidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Content Area */}
      <Box sx={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
        {renderContent()}
      </Box>
    </Box>
  );
}

export default MainPage;
