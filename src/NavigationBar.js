import React from 'react';
import './NavigationBar.css';

const NavigationBar = ({ currentView, onViewChange, blockchainData, current3DMode, on3DModeChange }) => {
  const { items, isConnected, connectionStatus } = blockchainData;

  return (
    <nav className="navigation-bar">
      <div className="nav-container">
        <div className="nav-left">
          <img src="/quai-logo.png" alt="Quai Network" className="nav-logo-img" />
        </div>
        
        <div className="nav-right">
          <div className="nav-stats">
            {/* 3D Mode Selector - only show when in 3D view */}
            {currentView === '3d' && (
              <div className="nav-3d-mode-selector">
                <span className="mode-label">Network:</span>
                <button 
                  className={`mode-button ${current3DMode === 'mainnet' ? 'active' : ''}`}
                  onClick={() => on3DModeChange('mainnet')}
                  title="Live Mainnet Data"
                >
                  Mainnet
                </button>
                <button 
                  className={`mode-button ${current3DMode === '2x2' ? 'active' : ''}`}
                  onClick={() => on3DModeChange('2x2')}
                  title="2x2 Hierarchy Demo"
                >
                  2x2 Demo
                </button>
              </div>
            )}
            
            <div className="nav-view-selector">
              <button 
                className={`view-button ${currentView === '3d' ? 'active' : ''}`}
                onClick={() => onViewChange('3d')}
              >
                3D
              </button>
              <button 
                className={`view-button ${currentView === 'normal' ? 'active' : ''}`}
                onClick={() => onViewChange('normal')}
              >
                2D
              </button>
            </div>
            <div className="stat-item">
              <span className="stat-label">Items</span>
              <span className="stat-value">{items.length}</span>
            </div>
            <div className="status-indicator-container">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <div className="status-text">
                <span className="status-label">{connectionStatus}</span>
                {!isConnected && <span className="demo-badge">Demo</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;