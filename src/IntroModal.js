import React, { useState, useEffect } from 'react';
import './IntroModal.css';

const IntroModal = ({ onConnect }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleConnect = () => {
    setIsAnimating(true);
    
    // Create dust particle animation
    const modal = document.querySelector('.intro-modal');
    if (modal) {
      // Add particle effect class
      modal.classList.add('particles-dissolve');
      
      // Wait for animation to complete before calling onConnect
      setTimeout(() => {
        setIsVisible(false);
        onConnect();
      }, 1000); // Match animation duration
    } else {
      // Fallback if modal element not found
      setIsVisible(false);
      onConnect();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="intro-modal-overlay">
      <div className={`intro-modal ${isAnimating ? 'dissolving' : ''}`}>
        <div className="intro-content">
          <h1 className="intro-title">
            Explore the network of the future
          </h1>
          <button 
            className="connect-button"
            onClick={handleConnect}
            disabled={isAnimating}
          >
            {isAnimating ? 'Connecting...' : 'Launch Quai!'}
          </button>
        </div>
        
        {/* Particle container for animation */}
        <div className="particles-container">
          {[...Array(50)].map((_, i) => (
            <div 
              key={i} 
              className="particle"
              style={{
                '--delay': `${Math.random() * 0.5}s`,
                '--x': `${Math.random() * 100}%`,
                '--y': `${Math.random() * 100}%`,
                '--size': `${Math.random() * 4 + 2}px`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntroModal;