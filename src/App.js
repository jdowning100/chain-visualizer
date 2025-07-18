import React, { useState } from 'react';
import ChainVisualizer from './ChainVisualizer';
import ChainVisualizer3D from './ChainVisualizer3D';
import NavigationBar from './NavigationBar';
import { useBlockchainData } from './useBlockchainData';
import { useBlockchainData2x2 } from './useBlockchainData2x2';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('3d');
  const [current3DMode, setCurrent3DMode] = useState('mainnet'); // 'mainnet' or '2x2'

  // Centralized blockchain data management
  const blockchainData = useBlockchainData();
  const blockchainData2x2 = useBlockchainData2x2(currentView === '3d' && current3DMode === '2x2');

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const handle3DModeChange = (mode) => {
    setCurrent3DMode(mode);
  };

  // Select appropriate blockchain data based on current mode
  const getActiveBlockchainData = () => {
    if (currentView === '3d' && current3DMode === '2x2') {
      return blockchainData2x2;
    }
    return blockchainData;
  };

  return (
    <div className="App">
      <NavigationBar 
        currentView={currentView} 
        onViewChange={handleViewChange} 
        blockchainData={getActiveBlockchainData()}
        current3DMode={current3DMode}
        on3DModeChange={handle3DModeChange}
      />
      <div className="app-content">
        {currentView === 'normal' ? 
          <ChainVisualizer blockchainData={blockchainData} /> : 
          <ChainVisualizer3D 
            blockchainData={getActiveBlockchainData()} 
            mode={current3DMode}
          />
        }
      </div>
    </div>
  );
}

export default App;