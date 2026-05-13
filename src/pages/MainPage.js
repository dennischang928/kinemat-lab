import { useState } from 'react';
import { Box } from '@mui/material';
import MainSidebar from '../components/common/MainSidebar';
import KinematicsView from '../components/views/KinematicsView';
import DigitalTwinView from '../components/views/DigitalTwinView';
import { BrowserRouter, Routes, Route } from "react-router";



function MainPage() {
  const [digitalTwinSection, setDigitalTwinSection] = useState('control');

  return (
    <BrowserRouter>
      <Box sx={{ display: 'flex', width: '100%', height: '100vh', bgcolor: '#f5f5f5' }}>
        {/* Main Sidebar */}
        <MainSidebar />

        {/* Content Area */}
        <Box sx={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<KinematicsView />} />
            <Route path="/kinematics" element={<KinematicsView />} />
            <Route path="/digitaltwin" element={<DigitalTwinView activeSection={digitalTwinSection} onSectionChange={setDigitalTwinSection} />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default MainPage;
