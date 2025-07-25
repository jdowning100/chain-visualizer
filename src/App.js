import React, { useState } from 'react';
import ChainVisualizer from './ChainVisualizer';
import ChainVisualizer3D from './ChainVisualizer3D';
import NavigationBar from './NavigationBar';
import IntroModal from './IntroModal';
import { useBlockchainData } from './useBlockchainData';
import { useBlockchainData2x2 } from './useBlockchainData2x2';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('3d');
  const [current3DMode, setCurrent3DMode] = useState('mainnet'); // 'mainnet' or '2x2'
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Centralized blockchain data management - only load data for active mode after user interaction
  const shouldLoadMainnet = hasUserInteracted && (currentView === 'normal' || (currentView === '3d' && current3DMode === 'mainnet'));
  const shouldLoad2x2 = hasUserInteracted && currentView === '3d' && current3DMode === '2x2';
  
  const blockchainData = useBlockchainData(shouldLoadMainnet);
  const blockchainData2x2 = useBlockchainData2x2(shouldLoad2x2);

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const handle3DModeChange = (mode) => {
    setCurrent3DMode(mode);
  };

  const handleModalConnect = () => {
    setHasUserInteracted(true);
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
      {!hasUserInteracted && currentView === '3d' && (
        <IntroModal onConnect={handleModalConnect} />
      )}
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
            hasUserInteracted={hasUserInteracted}
          />
        }
      </div>
    </div>
  );
}

export default App;