import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createTheme, themeConfigs } from './themes';
import './ChainVisualizer.css';

const MaxBlocksToFetch = 10;

const ChainVisualizer = React.memo(({ blockchainData, mode = 'mainnet', hasUserInteracted = false }) => {  
  // Extract data from props
  const {
    items,
    wsConnection,
    isConnected,
    connectionStatus,
    tipBlockHeight,
    maxHeightRef,
    fetchingParentsRef,
    missingParentsRef,
    fetchMissingParent
  } = blockchainData;
  
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const zoomRef = useRef(null);
  const prevMinHeightRef = useRef(null);
  const prevMaxHeightRef = useRef(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [userMovedCamera, setUserMovedCamera] = useState(false);
  const [initialCameraSetup, setInitialCameraSetup] = useState(false);
  const renderTimeoutRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const targetScrollOffsetRef = useRef(0);
  const animationFrameRef = useRef(null);
  const absoluteMinTimestampRef = useRef(null);
  const raycasterRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [currentTheme, setCurrentTheme] = useState(mode === 'mainnet' ? 'space' : 'quai');
  const [userSelectedTheme, setUserSelectedTheme] = useState(false);
  const currentThemeRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef(null);
  const [userInteracted, setUserInteracted] = useState(hasUserInteracted);

  // Get theme-specific block colors
  const getThemeColors = useCallback((themeName) => {
    const baseColors = {
      block: 0x4CAF50,      // Green for zone blocks
      primeBlock: 0xF44336, // Red for prime blocks
      regionBlock: 0xFFEB3B, // Yellow for region blocks
      uncle: 0xFF9800,      // Orange for uncles
      workshare: 0x2196F3,  // Blue for workshares
      arrow: 0xF5F5F5,      // Very light gray for arrows
      text: 0xffffff        // White for text
    };

    switch (themeName) {
      case 'space':
        return {
          ...baseColors,
          block: 0x4488ff,      // Space blue for zone blocks
          primeBlock: 0x9966ff, // Purple/violet for prime blocks (nebula colors)
          regionBlock: 0x44ccff, // Bright cyan for region blocks (stellar colors)
          uncle: 0xff6644,      // Orange-red for uncles (mars/asteroid colors)
          workshare: 0x88ffaa,  // Light green for workshares (aurora colors)
          arrow: 0xaaaaff,      // Light blue arrows
          text: 0xffffff
        };
      case 'tron':
        return {
          ...baseColors,
          block: 0x1a1a1a,      // Black for zone blocks
          primeBlock: 0x2a2a2a, // Dark gray for prime blocks
          regionBlock: 0x3a3a3a, // Silver for region blocks
          uncle: 0x0a0a0a,      // Very dark for uncles
          workshare: 0x2a2a2a,  // Dark gray for workshares
          arrow: 0x00d4ff,      // Bright cyan arrows
          text: 0x00d4ff        // Cyan text
        };
      default:
        return baseColors;
    }
  }, []);

  // 3D Configuration - continuous spacing layout
  const config = useMemo(() => ({
    spacing: 0.09,             // Spacing per millisecond for timestamp-based positioning
    scrollSpeed: .5,        // Pixels per frame for continuous scroll
    arrowLength: 30,
    colors: getThemeColors(currentTheme),
    sizes: {
      zone: 40,             // Smaller blocks for better flow
      region: 60,           // Region block 50% larger
      prime: 80             // Prime block double size
    }
  }), [currentTheme, getThemeColors]);

  // Theme music configuration
  const themeMusic = useMemo(() => ({
    normal: null,
    space: '/music/shooting-stars.mp3',
    tron: '/music/son-of-flynn.mp3',
    quai: '/music/sandstorm.mp3'
  }), []);


  // Audio control functions
  const playThemeMusic = useCallback((themeName) => {
    if (!audioEnabled) {
      console.log('Audio not enabled');
      return;
    }

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    const musicFile = themeMusic[themeName];
    if (musicFile) {
      try {
        audioRef.current = new Audio(musicFile);
        audioRef.current.volume = volume;
        audioRef.current.loop = true;
        audioRef.current.play().catch(error => {
          console.log('Could not play theme music (user interaction may be required):', error);
        });
        console.log('🎵 Attempting to play:', musicFile);
      } catch (error) {
        console.log('Error loading theme music:', error);
      }
    }
  }, [volume, themeMusic, audioEnabled]);

  const stopThemeMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Theme switching function
  const switchTheme = useCallback((themeName) => {
    if (sceneRef.current) {
      // Update background color based on theme
      const backgroundColors = {
        space: 0x000000,    // Black for space theme
        tron: 0x0a0a0a,     // Very dark for tron theme  
        quai: 0x1a1a1a,     // Dark grey for quai theme
        normal: 0x1a1a1a    // Dark grey for normal theme
      };
      
      const backgroundColor = backgroundColors[themeName] || backgroundColors.normal;
      console.log('🎨 Setting background color for theme:', themeName, 'to:', backgroundColor.toString(16));
      sceneRef.current.background = new THREE.Color(backgroundColor);
      
      // Also update renderer clear color if available
      if (rendererRef.current) {
        rendererRef.current.setClearColor(backgroundColor, 1.0);
        console.log('🎨 Updated renderer clear color to:', backgroundColor.toString(16));
      }
      
      // Clean up all existing theme elements
      const themeElements = sceneRef.current.children.filter(child => 
        child.userData.isPlanet || child.userData.isSun || child.userData.isAsteroid || 
        child.userData.isGalaxy || child.userData.isShootingStar || child.userData.isRocketship ||
        child.userData.isVideoBackground || child.userData.isFloatingText || 
        child.userData.isNyanCat || child.userData.isThemeElement ||
        child.userData.isTronGrid || child.userData.isTronLighting || 
        child.userData.isTronDisc || child.userData.isDataStream || child.userData.isLightCycle
      );
      
      themeElements.forEach(element => {
        sceneRef.current.remove(element);
        // Dispose of geometry and materials
        if (element.geometry) element.geometry.dispose();
        if (element.material) {
          if (Array.isArray(element.material)) {
            element.material.forEach(material => material.dispose());
          } else {
            element.material.dispose();
          }
        }
        // Dispose of any child objects
        element.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
    }
    
    // Clean up current theme instance
    if (currentThemeRef.current) {
      currentThemeRef.current.cleanup();
      currentThemeRef.current = null;
    }
    
    // Create new theme instance
    if (themeName !== 'normal' && sceneRef.current) {
      currentThemeRef.current = createTheme(themeName, sceneRef.current);
    }
    
    // Update existing block colors for the new theme
    if (sceneRef.current) {
      const newColors = getThemeColors(themeName);
      
      sceneRef.current.children.forEach(child => {
        if (child.userData.isBlock && child.userData.item) {
          const item = child.userData.item;
          let newColor = newColors[item.type] || newColors.block;

          // For workshares, maintain the animation logic
          if (item.type === 'workshare') {
            if (child.userData.isNewWorkshare && child.userData.animationStartTime) {
              const elapsed = Date.now() - child.userData.animationStartTime;
              const animationDuration = 2000; // 2 seconds
              if (elapsed < animationDuration) {
                const progress = elapsed / animationDuration;
                // Interpolate from white to theme color
                const white = new THREE.Color(0xffffff);
                const targetColor = new THREE.Color(newColor);
                const currentColor = white.lerp(targetColor, progress);
                newColor = currentColor.getHex();
              } else {
                child.userData.isNewWorkshare = false;
                child.userData.animationStartTime = null;
              }
            }
          }
          
          // Update the material color and glow properties
          if (child.material && child.material.color) {
            child.material.color.setHex(newColor);
            
            // Add glow effect for Tron theme
            if (themeName === 'tron') {
              child.material.emissive = new THREE.Color(0x00d4ff); // Cyan edge glow
              child.material.emissiveIntensity = 0.2;
              child.material.roughness = 0.8;
              child.material.metalness = 0.9;
              child.material.clearcoat = 1.0;
              child.material.clearcoatRoughness = 0.0;
              child.material.transparent = false;
              child.material.opacity = 1.0;
            } else if (themeName === 'quai') {
              // Use QuaiTheme material properties for existing blocks
              const chainType = item.type === 'primeBlock' ? 'prime' : 
                               item.type === 'regionBlock' ? 'region' : 
                               item.type === 'block' ? 'zone' : 
                               item.type === 'workshare' ? 'workshare' : item.type;
              const quaiMaterial = currentThemeRef.current?.getBlockMaterial(chainType, item.type === 'uncle');
              if (quaiMaterial) {
                // Copy properties from QuaiTheme material
                child.material.emissive = quaiMaterial.emissive.clone();
                child.material.emissiveIntensity = quaiMaterial.emissiveIntensity;
                child.material.metalness = quaiMaterial.metalness;
                child.material.roughness = quaiMaterial.roughness;
                child.material.transmission = quaiMaterial.transmission;
                child.material.thickness = quaiMaterial.thickness;
                child.material.clearcoat = quaiMaterial.clearcoat;
                child.material.clearcoatRoughness = quaiMaterial.clearcoatRoughness;
                child.material.transparent = quaiMaterial.transparent;
                child.material.opacity = quaiMaterial.opacity;
              }
              
              // Apply Quai theme animation to existing blocks
              if (currentThemeRef.current && currentThemeRef.current.animateBlock) {
                currentThemeRef.current.animateBlock(child, chainType);
              }
            } else {
              // Reset to normal material properties
              child.material.emissive = new THREE.Color(0x000000);
              child.material.roughness = 0.1;
              child.material.metalness = 0.0;
              child.material.clearcoatRoughness = 0.1;
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.material.transmission = 0;
              child.material.thickness = 0;
              child.material.map = null; // Remove any textures
            }
            
            child.material.needsUpdate = true; // Force material update
            
            // Add or remove edge lines based on theme
            if (themeName === 'tron') {
              // Check if edges already exist
              const existingEdges = child.children.find(c => c.type === 'LineSegments');
              if (!existingEdges) {
                // Add edge lines
                const edges = new THREE.EdgesGeometry(child.geometry);
                const lineMaterial = new THREE.LineBasicMaterial({ 
                  color: 0x00d4ff, // Cyan edges
                  linewidth: 2
                });
                const lineSegments = new THREE.LineSegments(edges, lineMaterial);
                child.add(lineSegments);
              }
            } else {
              // Remove edge lines if they exist
              const existingEdges = child.children.find(c => c.type === 'LineSegments');
              if (existingEdges) {
                child.remove(existingEdges);
                if (existingEdges.geometry) existingEdges.geometry.dispose();
                if (existingEdges.material) existingEdges.material.dispose();
              }
              
              // Remove Quai theme glow effects if they exist
              if (child.userData.glow) {
                child.remove(child.userData.glow);
                if (child.userData.glow.geometry) child.userData.glow.geometry.dispose();
                if (child.userData.glow.material) child.userData.glow.material.dispose();
                child.userData.glow = null;
              }
            }
          }
        }
      });
    }
    
    // Play theme music
    playThemeMusic(themeName);
    
    console.log('switchTheme: setting currentTheme from', currentTheme, 'to', themeName);
    setCurrentTheme(themeName);
  }, [playThemeMusic]);

  // Debug: Monitor currentTheme changes and call switchTheme when user selects manually
  useEffect(() => {
    console.log('currentTheme state changed to:', currentTheme);
    if (userSelectedTheme) {
      console.log('User selected theme, calling switchTheme with:', currentTheme);
      switchTheme(currentTheme);
    }
  }, [currentTheme, userSelectedTheme, switchTheme]);

  // Update audio volume when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle theme music changes (only when scene is ready and user has interacted)
  useEffect(() => {
    if (sceneReady && userInteracted) {
      playThemeMusic(currentTheme);
    }
  }, [currentTheme, playThemeMusic, sceneReady, userInteracted]);

  // Update theme when mode changes (only if user hasn't manually selected a theme)
  useEffect(() => {
    if (!userSelectedTheme) {
      const defaultTheme = mode === 'mainnet' ? 'space' : 'quai';
      if (currentTheme !== defaultTheme) {
        console.log('🔄 Mode changed, switching to default theme:', defaultTheme, 'userSelectedTheme:', userSelectedTheme);
        setCurrentTheme(defaultTheme);
      }
    } else {
      console.log('👤 User has manually selected theme, skipping auto-switch. userSelectedTheme:', userSelectedTheme, 'currentTheme:', currentTheme);
    }
  }, [mode, userSelectedTheme]); // Remove currentTheme from dependencies to prevent infinite loop

  // Sync user interaction state from parent
  useEffect(() => {
    if (hasUserInteracted && !userInteracted) {
      setUserInteracted(true);
    }
  }, [hasUserInteracted, userInteracted]);

  // Initialize theme when scene becomes ready and user has interacted
  useEffect(() => {
    if (sceneReady && userInteracted) {
      console.log('🎨 Initializing theme on scene ready:', currentTheme);
      switchTheme(currentTheme);
    }
  }, [sceneReady, userInteracted, currentTheme, switchTheme]);


  // Three.js 3D Initialization
  useEffect(() => {
    console.log('🎬 Three.js initialization effect starting');
    
    if (!mountRef.current) {
      console.log('❌ No mount ref available');
      return;
    }
    
    // Prevent double initialization (React StrictMode can cause this)
    if (sceneRef.current) {
      console.log('⚠️ Scene already exists, skipping initialization');
      return;
    }
    
    // Check if container has valid dimensions
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    if (width === 0 || height === 0) {
      console.log('⚠️ Container has no dimensions yet, deferring Three.js init');
      // Defer initialization to next tick
      const timeoutId = setTimeout(() => {
        if (mountRef.current && mountRef.current.clientWidth > 0) {
          // Re-trigger this effect by updating a state
          setSceneReady(false);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    
    console.log('📐 Container dimensions:', width, 'x', height);
    
    // Initialize Three.js scene
    const scene = new THREE.Scene();
    // Set initial background color based on current theme
    const initialBackgroundColors = {
      space: 0x000000,    // Black for space theme
      tron: 0x0a0a0a,     // Very dark for tron theme  
      quai: 0x1a1a1a,     // Dark grey for quai theme
      normal: 0x1a1a1a    // Dark grey for normal theme
    };
    const initialBackgroundColor = initialBackgroundColors[currentTheme] || initialBackgroundColors.normal;
    console.log('🎬 Setting initial background color for theme:', currentTheme, 'to:', initialBackgroundColor.toString(16));
    scene.background = new THREE.Color(initialBackgroundColor);
    sceneRef.current = scene;
    
    // Initialize camera with extended view range
    const camera = new THREE.PerspectiveCamera(
      75, // Increased FOV for wider view
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      1,    // Increased near plane to prevent z-fighting
      12000 // Much larger far plane to prevent blocks disappearing
    );
    camera.position.set(1000, 600, 1500); // Match recenter view: side angle, less top-down
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Initialize renderer with debugging
    console.log('🖥️ Initializing WebGL renderer...');
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // For debugging
    });
    
    // Use the already validated dimensions
    renderer.setSize(width, height);
    console.log('🖥️ Renderer size set to:', width, 'x', height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(initialBackgroundColor, 1.0); // Set background color to match theme
    console.log('🖥️ Set renderer clear color to:', initialBackgroundColor.toString(16));
    rendererRef.current = renderer;
    
    // Clear any existing canvases first
    while (mountRef.current.firstChild) {
      console.log('🧹 Removing existing canvas');
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    
    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement);
    console.log('🖥️ Renderer added to DOM:', renderer.domElement);
    
    // Check WebGL context
    const gl = renderer.getContext();
    console.log('🖥️ WebGL context:', gl ? 'Available' : 'Failed');
    console.log('🖥️ WebGL version:', gl.getParameter(gl.VERSION));
    console.log('🖥️ WebGL renderer:', gl.getParameter(gl.RENDERER));
    
    // Delay OrbitControls initialization to ensure DOM is ready
    setTimeout(() => {
      if (!renderer.domElement || !renderer.domElement.parentNode) {
        console.error('❌ Renderer DOM element not ready for controls');
        return;
      }
      
      // Initialize orbit controls with extended limits
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 10;   // Allow closer zoom
      controls.maxDistance = 8000; // Much larger max distance
      controls.maxPolarAngle = Math.PI;
      controls.enabled = true;
      
      // Prevent extreme panning that might lose blocks
      controls.enablePan = true;
      controls.panSpeed = 1.0;
      controls.keyPanSpeed = 1.0;
      
      controlsRef.current = controls;
      setControlsReady(true);
      console.log('🎮 OrbitControls initialized after delay:', controls.enabled);
      
      // Force an update
      controls.update();
      
      // Now mark scene as ready since controls are properly initialized
      setSceneReady(true);
      console.log('✅ Scene marked as ready');
    }, 100); // 100ms delay to ensure DOM is ready
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    
    
    // Initialize raycaster for mouse interactions
    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;
    
    // Animation loop with smooth scrolling
    let frameCount = 0;
    let lastBlockCount = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Smooth scrolling animation - interpolate towards target
      const targetDiff = targetScrollOffsetRef.current - scrollOffsetRef.current;
      if (Math.abs(targetDiff) > 5) {
        // Smooth interpolation when target changes significantly
        scrollOffsetRef.current += targetDiff * 0.05; // Smooth but responsive transition
      } else {
        // Normal continuous scrolling when close to target
        scrollOffsetRef.current += config.scrollSpeed;
        targetScrollOffsetRef.current += config.scrollSpeed;
      }
      
      // Update theme animations
      if (currentThemeRef.current && currentThemeRef.current.updateAnimations) {
        currentThemeRef.current.updateAnimations();
      }
      
      // Update all block positions and remove off-screen objects
      if (sceneRef.current) {
        const toRemove = [];
        
        sceneRef.current.children.forEach(child => {
          if (child.userData.isBlock && child.userData.originalPosition) {
            const newX = child.userData.originalPosition.x - scrollOffsetRef.current;
            child.position.x = newX;
            
            // Workshare animation is now handled by THREE.js tween system, not in the loop
            
            // Mark blocks that are far off-screen for removal
            if (newX < -10000) { // Off-screen to the left (increased distance)
              toRemove.push(child);
            }
          }
          if (child.userData.isArrow && child.userData.originalPoints) {
            // Update arrow positions - validate scroll offset first
            const scrollOffset = isNaN(scrollOffsetRef.current) ? 0 : scrollOffsetRef.current;
            const points = child.userData.originalPoints.map(point => 
              new THREE.Vector3(point.x - scrollOffset, point.y, point.z)
            );
            
            // Validate points to prevent NaN errors
            const validPoints = points.every(point => 
              !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
            );
            
            if (validPoints) {
              child.geometry.setFromPoints(points);
              
              // Mark arrows that are far off-screen for removal
              const leftmostX = Math.min(...points.map(p => p.x));
              if (leftmostX < -10000) { // Off-screen to the left (increased distance)
                toRemove.push(child);
              }
            } else {
              console.warn('Invalid arrow points detected in scroll update, removing arrow:', points);
              toRemove.push(child);
            }
          }
        });
        
        // Remove off-screen objects to improve performance
        const removedBlockIds = [];
        toRemove.forEach(child => {
          if (child.userData.isBlock) {
            removedBlockIds.push(child.userData.item.id);
          }
          sceneRef.current.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        
        // Also remove any arrows that referenced the removed blocks
        if (removedBlockIds.length > 0) {
          const arrowsToRemove = sceneRef.current.children.filter(child => {
            if (child.userData.isArrow && child.userData.arrowId) {
              const [, parentId, childId] = child.userData.arrowId.match(/^arrow-(.+)-(.+)$/) || [];
              return removedBlockIds.includes(parentId) || removedBlockIds.includes(childId);
            }
            return false;
          });
          
          arrowsToRemove.forEach(arrow => {
            sceneRef.current.remove(arrow);
            if (arrow.geometry) arrow.geometry.dispose();
            if (arrow.material) arrow.material.dispose();
          });
        }
      }
      
      // Update controls if available (might not be ready on first frames)
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      // Check if we can actually render
      try {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      } catch (error) {
        console.error('🖥️ Render error:', error);
      }
      
      // Log every 60 frames (roughly once per second at 60fps)
      frameCount++;
      if (frameCount % 60 === 0) {
        const blockCount = scene.children.filter(child => child.userData.isBlock).length;
        
        if (blockCount !== lastBlockCount) {
          lastBlockCount = blockCount;
        }
        
        // Check if canvas is actually visible
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        if (frameCount === 60) { // Only log once
        }
      }
    };
    animate();

    // Add keyboard controls for debugging
    const handleKeyPress = (event) => {
      if (!cameraRef.current) return;
      const moveSpeed = 50;
      switch(event.key) {
        case 'w': cameraRef.current.position.z -= moveSpeed; break;
        case 's': cameraRef.current.position.z += moveSpeed; break;
        case 'a': cameraRef.current.position.x -= moveSpeed; break;
        case 'd': cameraRef.current.position.x += moveSpeed; break;
        case 'q': cameraRef.current.position.y += moveSpeed; break;
        case 'e': cameraRef.current.position.y -= moveSpeed; break;
        case 'r': // Reset camera to show blockchain flow
          cameraRef.current.position.set(-200, 150, 400);
          if (controlsRef.current) {
            controlsRef.current.target.set(0, 0, 0);
            controlsRef.current.update();
          }
          setUserMovedCamera(false); // Allow auto-positioning again
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    
    // Track user interaction for audio
    const handleUserInteraction = () => {
      setUserInteracted(true);
      // Try to play music if a theme is active
      if (currentTheme !== 'normal' && !audioRef.current && themeMusic[currentTheme]) {
        playThemeMusic(currentTheme);
      }
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    
    // Mouse event handlers for hover and click
    const handleMouseMove = (event) => {
      if (!mountRef.current || !raycasterRef.current || !cameraRef.current) return;
      
      const rect = mountRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      
      // Find the first intersected block
      const blockIntersect = intersects.find(intersect => 
        intersect.object.userData.isBlock || intersect.object.parent?.userData.isBlock
      );
      
      if (blockIntersect) {
        const blockMesh = blockIntersect.object.userData.isBlock ? 
          blockIntersect.object : blockIntersect.object.parent;
        const item = blockMesh.userData.item;
        
        setHoveredBlock(item);
        setTooltip({
          visible: true,
          x: event.clientX + 10,
          y: event.clientY + 10,
          content: `Block: ${item.hash}\nNumber: #${item.number || 'N/A'}\nType: ${item.type}\nParent: ${item.parentHash || 'N/A'}`
        });
        
        // Change cursor to pointer
        mountRef.current.style.cursor = 'pointer';
      } else {
        setHoveredBlock(null);
        setTooltip({ visible: false, x: 0, y: 0, content: '' });
        mountRef.current.style.cursor = 'default';
      }
    };
    
    const handleMouseClick = (event) => {
      if (!mountRef.current || !raycasterRef.current || !cameraRef.current || !sceneRef.current) return;
      
      // Recalculate intersection on click to ensure we have the current state
      const rect = mountRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      const mouse = new THREE.Vector2(x, y);
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      
      // Find the first intersected block
      const blockIntersect = intersects.find(intersect => 
        intersect.object.userData.isBlock || intersect.object.parent?.userData.isBlock
      );
      
      if (blockIntersect) {
        const blockMesh = blockIntersect.object.userData.isBlock ? 
          blockIntersect.object : blockIntersect.object.parent;
        const item = blockMesh.userData.item;
        
        // Only open QuaiScan for mainnet mode, not 2x2 demo
        if (item && item.number && mode === 'mainnet') {
          // Open QuaiScan link
          const blockNumber = item.number;
          console.log('Opening QuaiScan for block:', blockNumber);
          window.open(`https://quaiscan.io/block/${blockNumber}`, '_blank');
        } else if (mode === '2x2') {
          console.log('QuaiScan disabled for 2x2 demo mode');
        }
      }
    };
    
    mountRef.current.addEventListener('mousemove', handleMouseMove);
    mountRef.current.addEventListener('click', handleMouseClick);
    
    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    
    return () => {
      console.log('🧹 Cleaning up Three.js resources');
      
      // First, mark scene as not ready to stop new renders
      setSceneReady(false);
      setControlsReady(false);
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      if (mountRef.current) {
        mountRef.current.removeEventListener('mousemove', handleMouseMove);
        mountRef.current.removeEventListener('click', handleMouseClick);
      }
      
      // Cleanup theme
      if (currentThemeRef.current) {
        currentThemeRef.current.cleanup();
        currentThemeRef.current = null;
      }
      
      // Cleanup audio
      stopThemeMusic();
      
      // Dispose controls first (they reference the renderer)
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
      // Clear and dispose scene
      if (sceneRef.current) {
        sceneRef.current.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      
      // Dispose renderer last
      if (rendererRef.current) {
        if (mountRef.current && rendererRef.current.domElement) {
          try {
            mountRef.current.removeChild(rendererRef.current.domElement);
          } catch (e) {
            console.log('Canvas already removed from DOM');
          }
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      // Clear any remaining children in mount container
      if (mountRef.current) {
        while (mountRef.current.firstChild) {
          mountRef.current.removeChild(mountRef.current.firstChild);
        }
      }
      
      // Clear remaining refs
      cameraRef.current = null;
      scrollOffsetRef.current = 0;
      targetScrollOffsetRef.current = 0;
      absoluteMinTimestampRef.current = null;
      
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);
  
  // Three.js 3D visualization - with debouncing to prevent excessive renders
  useEffect(() => {
    // Clear any existing timeout
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    
    // Debounce the rendering to avoid excessive calls
    renderTimeoutRef.current = setTimeout(() => {
    
    // Comprehensive validation before rendering
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) {
      console.log('⚠️ Three.js not fully initialized yet, skipping render');
      return;
    }
    
    // Wait for scene to be ready
    if (!sceneReady) {
      console.log('⚠️ Scene not ready yet, skipping render');
      return;
    }
    
    // Additional check for valid renderer
    if (!rendererRef.current.domElement.parentNode) {
      console.log('⚠️ Renderer not attached to DOM, skipping render');
      return;
    }
    
    const scene = sceneRef.current;
    const currentBlockCount = scene.children.filter(child => child.userData.isBlock).length;
    
    // console.log(`🎨 Processing ${items.length} items, currently ${currentBlockCount} blocks in scene`);
    
    // Clear only blocks and arrows that are no longer in items
    const existingBlocks = scene.children.filter(child => child.userData.isBlock);
    const existingArrows = scene.children.filter(child => child.userData.isArrow);
    const currentItemIds = new Set(items.map(item => item.id));
    
    // Remove blocks that are no longer needed
    existingBlocks.forEach(block => {
      if (!currentItemIds.has(block.userData.item.id)) {
        scene.remove(block);
        if (block.geometry) block.geometry.dispose();
        if (block.material) block.material.dispose();
      }
    });
    
    // Remove arrows whose parent or child blocks no longer exist in scene
    existingArrows.forEach(arrow => {
      const arrowId = arrow.userData.arrowId;
      if (arrowId) {
        const [, parentId, childId] = arrowId.match(/^arrow-(.+)-(.+)$/) || [];
        if (parentId && childId) {
          // Check if both parent and child blocks actually exist in the scene
          const parentBlockExists = scene.children.some(child => 
            child.userData.isBlock && child.userData.item.id === parentId
          );
          const childBlockExists = scene.children.some(child => 
            child.userData.isBlock && child.userData.item.id === childId
          );
          
          if (!parentBlockExists || !childBlockExists) {
            scene.remove(arrow);
            if (arrow.geometry) arrow.geometry.dispose();
            if (arrow.material) arrow.material.dispose();
          }
        }
      }
    });
    
    // Early return if no items
    if (items.length === 0) {
      console.log('❌ No items to render');
      return;
    }
    
    // Compute minTimestamp for normalization based on timestamps
    const currentMinTimestamp = Math.min(...items.map(item => item.timestamp ?? Infinity));
    
    // Initialize absolute minimum timestamp on first run, never update it
    if (absoluteMinTimestampRef.current === null && items.length > 0) {
      absoluteMinTimestampRef.current = currentMinTimestamp;
      console.log('📍 Set absolute minimum timestamp:', absoluteMinTimestampRef.current);
    }
    
    // Use absolute minimum for positioning to maintain consistent flow
    const minTimestamp = absoluteMinTimestampRef.current || currentMinTimestamp;
    const maxBlockSize = Math.max(...Object.values(config.sizes));
    
    // Base Y positions by type - separate chains in 3D space with increased spacing
    // For 2x2 mode, use more organized hierarchy positioning
    const typeBaseY = mode === '2x2' ? {
      primeBlock: 600,    // Prime chain higher up for 2x2 hierarchy
      regionBlock: 300,   // Region chains in middle
      block: 0,           // Zone chains at center
      uncle: -(maxBlockSize + 50), 
      workshare: -(maxBlockSize * 2 + 100),
    } : {
      primeBlock: 400,    // Normal mainnet positioning
      regionBlock: 200,   
      block: 0,           
      uncle: -(maxBlockSize + 50),     
      workshare: -(maxBlockSize * 2 + 100), 
    };
    
    // Group items by height for stacking calculation (matching D3)
    const heightToItems = new Map();
    items.forEach(item => {
      const height = item.number;
      if (!heightToItems.has(height)) {
        heightToItems.set(height, []);
      }
      heightToItems.get(height).push(item);
    });
    
    // Compute workshare counts per parent (matching D3)
    const workshareCounts = new Map();
    items.filter(i => i.type === 'workshare').forEach(ws => {
      const count = workshareCounts.get(ws.fullParentHash) || 0;
      workshareCounts.set(ws.fullParentHash, count + 1);
    });
    
    // Update existing block sizes based on current workshare counts
    existingBlocks.forEach(blockMesh => {
      const item = blockMesh.userData.item;
      if (['block', 'primeBlock', 'regionBlock'].includes(item.type)) {
        const currentWorkshareCount = workshareCounts.get(item.fullHash) || 0;
        
        // Calculate what the size should be now
        let baseSize = config.sizes.zone;
        if (item.type === 'primeBlock') baseSize = config.sizes.prime;
        else if (item.type === 'regionBlock') baseSize = config.sizes.region;
        
        const newSize = baseSize * (1 + 0.2 * currentWorkshareCount);
        const currentSize = blockMesh.userData.originalSize;
        
        if (Math.abs(newSize - currentSize) > 0.1) { // Only update if size changed significantly          
          // Update the geometry
          blockMesh.geometry.dispose();
          blockMesh.geometry = new THREE.BoxGeometry(newSize, newSize, newSize, 32, 32, 32);
          
          // Update stored size
          blockMesh.userData.originalSize = newSize;
          
          // Update text planes inside the block
          blockMesh.children.forEach(child => {
            if (child.geometry && child.geometry.type === 'PlaneGeometry') {
              child.geometry.dispose();
              child.geometry = new THREE.PlaneGeometry(newSize * 0.8, newSize * 0.8);
              // Reposition text planes
              if (child.position.z > 0) {
                child.position.z = newSize / 2 + 0.1; // Front face
              } else {
                child.position.z = -newSize / 2 - 0.1; // Back face
              }
            }
          });
        }
      }
    });
    
    let blocksAdded = 0;
    let blocksSkipped = 0;
    
    items.forEach((item, index) => {
      // console.log(`🔸 Processing item ${index}/${items.length}: ${item.hash} (${item.type}), number: ${item.number}`);
      
      // Skip uncles in 2x2 demo mode
      if (mode === '2x2' && item.type === 'uncle') {
        blocksSkipped++;
        return;
      }
      
      // Check if block already exists in scene
      const existingBlock = scene.children.find(child => 
        child.userData.isBlock && child.userData.item.id === item.id
      );
      if (existingBlock) {
        blocksSkipped++;
        return;
      }
      
      // Calculate block size with workshare scaling (matching D3 logic)
      let baseSize = config.sizes.zone;
      if (item.type === 'primeBlock') baseSize = config.sizes.prime;
      else if (item.type === 'regionBlock') baseSize = config.sizes.region;
      else baseSize = config.sizes.zone;

      let size = baseSize;
      if (['block', 'primeBlock', 'regionBlock'].includes(item.type)) {
        const count = workshareCounts.get(item.fullHash) || 0;
        size = baseSize * (1 + 0.2 * count); // Same scaling as D3
      }
      
      // Create rounded cube geometry with more subdivisions for smoother edges
      const geometry = new THREE.BoxGeometry(size, size, size, 32, 32, 32);
      
      // Create solid glass-like material with appropriate color
      let color = config.colors[item.type] || config.colors.block;
      
      // For workshares, start with white and animate to blue
      if (item.type === 'workshare') {
        color = 0xffffff; // Start white
        const currentColors = getThemeColors(currentTheme);
        console.log('Creating workshare: currentTheme =', currentTheme, 'config.colors.workshare =', config.colors.workshare.toString(16), 'getThemeColors.workshare =', currentColors.workshare.toString(16));
      }
      
      // Create glowy material for Tron theme, glass material for Quai, normal material for others
      let material;
      if (currentTheme === 'tron') {
        material = new THREE.MeshPhysicalMaterial({ 
          color: color,
          emissive: new THREE.Color(0x00d4ff), // Cyan glow for edges
          emissiveIntensity: 0.2,
          roughness: 0.8,
          metalness: 0.9,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
          transparent: false,
          opacity: 1.0
        });
      } else if (currentTheme === 'quai' && currentThemeRef.current) {
        // Use QuaiTheme material for new blocks
        const chainType = item.type === 'primeBlock' ? 'prime' : 
                         item.type === 'regionBlock' ? 'region' : 
                         item.type === 'block' ? 'zone' : item.type;
        if (item.type === 'workshare') {
          material = currentThemeRef.current.getWorkShareMaterial();
        } else {
          material = currentThemeRef.current.getBlockMaterial(chainType, item.type === 'uncle');
        }
      } else {
        material = new THREE.MeshPhysicalMaterial({ 
          color: color,
          roughness: 0.1,
          metalness: 0.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1
        });
      }
      
      // Create mesh
      const cube = new THREE.Mesh(geometry, material);
      cube.castShadow = true;
      cube.receiveShadow = true;
      
      // Add edge lines for Tron theme
      if (currentTheme === 'tron') {
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0x00d4ff, // Cyan edges
          linewidth: 2
        });
        const lineSegments = new THREE.LineSegments(edges, lineMaterial);
        cube.add(lineSegments);
      }
      
      // Position calculation for continuous left-to-right flow
      let posX, posY, posZ;
      
      // Validate timestamp to prevent NaN errors
      if (!item.timestamp || isNaN(item.timestamp) || !minTimestamp || isNaN(minTimestamp)) {
        console.warn('Invalid timestamp detected for item:', item.id, 'timestamp:', item.timestamp, 'minTimestamp:', minTimestamp);
        // Use fallback positioning
        posX = -200 - Math.random() * 100;
        posY = typeBaseY[item.type] || 0;
        posZ = 0;
      } else if (item.number === null) {
        if (item.type === 'workshare' && item.fullParentHash) {
          // For workshares with null numbers, position them based on their timestamp
          const parentBlock = items.find(p => p.fullHash === item.fullParentHash && p.type === 'block');
          if (parentBlock && parentBlock.timestamp) {
            const parentRelativeTime = parentBlock.timestamp - minTimestamp;
            const parentBaseX = parentRelativeTime * config.spacing;
            posX = parentBaseX + 800 - size; // Position to the left of parent
            posY = typeBaseY.block - size - 20; // Below parent
            
            // Spread multiple workshares for same parent in Z using stable timestamp ordering
            const worksharesForParent = items.filter(i => 
              i.type === 'workshare' && i.fullParentHash === item.fullParentHash
            );
            // Sort by timestamp to get stable ordering
            const sortedWorkshares = worksharesForParent.sort((a, b) => a.timestamp - b.timestamp);
            const workshareIndex = sortedWorkshares.findIndex(i => i.id === item.id);
            posZ = (workshareIndex - Math.floor(sortedWorkshares.length / 2)) * 80;
          } else {
            // Fallback for workshares without valid parent
            posX = -200 - Math.random() * 100;
            posY = typeBaseY.workshare || -200;
            // Use hash to generate consistent Z position
            const hashCode = item.hash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            posZ = ((hashCode % 5) - 2) * 80;
          }
        } else {
          // Non-workshare items without numbers
          posX = -200 - Math.random() * 100; 
          posY = Math.random() * 400 + 100;
          posZ = 0;
        }
      } else {
        // X-axis: Position new blocks based on timestamp, they'll scroll in
        const relativeTime = item.timestamp - minTimestamp;
        const baseX = relativeTime * config.spacing;
        posX = baseX + 800; // Start new blocks off-screen to the right

        // Y-axis: Different stacking for workshares vs other blocks
        const baseY = typeBaseY[item.type] || 0;
        
        if (item.type === 'workshare') {
          // Workshares don't stack vertically - they use Z-depth instead
          posY = baseY;
        } else {
          // For actual forks (different hashes at same height), spread them horizontally
          // But Prime/Region/Zone of same hash should stack vertically at same X,Z
          const sameHeightItems = heightToItems.get(item.number) || [];
          
          // Group by hash first - blocks with same hash should be at same X,Z
          const sameHashItems = sameHeightItems.filter(i => i.fullHash === item.fullHash);
          
          // Then find actual forks - different hashes at same height and same type
          const actualForks = sameHeightItems.filter(i => 
            i.fullHash !== item.fullHash && i.type === item.type
          );
          
          if (actualForks.length > 0) {
            // There are actual forks - different blocks at same height
            // Get all unique hashes at this height for this type
            const uniqueHashesAtHeight = [...new Set(sameHeightItems
              .filter(i => i.type === item.type)
              .map(i => i.fullHash))];
              
            if (uniqueHashesAtHeight.length > 1) {
              // Multiple different blocks (forks) at same height
              const hashIndex = uniqueHashesAtHeight.findIndex(hash => hash === item.fullHash);
              const forkOffset = (hashIndex - Math.floor(uniqueHashesAtHeight.length / 2)) * (size + 30);

              posX += forkOffset; // Adjust X position to spread actual forks horizontally
            }
          }
          
          posY = baseY; // Each type stays at its designated Y level
        }
        
        // Z-axis: For workshares, use depth instead of height stacking
        if (item.type === 'workshare') {
          if (item.fullParentHash) {
            // Use timestamp to determine stable Z position
            // This ensures workshares maintain their position even when new ones are added
            const worksharesForParent = items.filter(i => 
              i.type === 'workshare' && i.fullParentHash === item.fullParentHash
            );
            
            // Sort by timestamp to get stable ordering
            const sortedWorkshares = worksharesForParent.sort((a, b) => a.timestamp - b.timestamp);
            const workshareIndex = sortedWorkshares.findIndex(i => i.id === item.id);
            posZ = (workshareIndex - Math.floor(sortedWorkshares.length / 2)) * 80; // Spread wider in Z
          } else {
            // For workshares without parent, use hash to generate consistent Z position
            const hashCode = item.hash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            posZ = ((hashCode % 5) - 2) * 80; // Consistent position based on hash
          }
        } else if (mode === '2x2' && item.chainName) {
          // For 2x2 mode, spread chains across Z-axis based on chain name
          const getChainZOffset = (chainName) => {
            if (chainName === 'Prime') return 0; // Prime at center
            if (chainName === 'Region-0') return -300; // Region 0 to the left
            if (chainName === 'Region-1') return 300;  // Region 1 to the right
            if (chainName === 'Zone-0-0') return -450; // Zone 0-0 far left
            if (chainName === 'Zone-0-1') return -150; // Zone 0-1 left center
            if (chainName === 'Zone-1-0') return 150;  // Zone 1-0 right center
            if (chainName === 'Zone-1-1') return 450;  // Zone 1-1 far right
            return 0; // Fallback
          };
          posZ = getChainZOffset(item.chainName);
        } else {
          posZ = 0; // Keep other block types at Z=0
        }        
      }
      
      // Geometry is already created with the correct size
      
      // Check for overlap with existing blocks and adjust position if needed
      const existingBlocksAtHeight = scene.children.filter(child => 
        child.userData.isBlock && 
        child.userData.item.type === item.type &&
        Math.abs(child.userData.originalPosition.y - posY) < size/2
      );
      
      // Check horizontal overlaps
      for (const existingBlock of existingBlocksAtHeight) {
        const existingX = existingBlock.userData.originalPosition.x;
        const existingZ = existingBlock.userData.originalPosition.z;
        const existingSize = existingBlock.userData.originalSize;
        
        // If blocks would overlap horizontally (considering their sizes)
        const minDistance = (size + existingSize) / 2 + 20; // Add 20 units padding
        const distanceX = Math.abs(posX - existingX);
        const distanceZ = Math.abs(posZ - existingZ);
        
        if (distanceX < minDistance && distanceZ < minDistance) {
          // Adjust position to avoid overlap
          if (posX >= existingX) {
            posX = existingX + minDistance;
          } else {
            posX = existingX - minDistance;
          }
        }
      }
      
      // Validate final positions to prevent NaN errors
      if (isNaN(posX) || isNaN(posY) || isNaN(posZ)) {
        console.warn('Invalid position calculated for item:', item.id, 'posX:', posX, 'posY:', posY, 'posZ:', posZ);
        // Use fallback position
        posX = -200;
        posY = typeBaseY[item.type] || 0;
        posZ = 0;
      }
      
      // Store original position and set current position with scroll offset
      const originalPosition = { x: posX, y: posY, z: posZ };
      const scrollOffset = isNaN(scrollOffsetRef.current) ? 0 : scrollOffsetRef.current;
      const currentX = posX - scrollOffset;
      
      // Validate final cube position
      if (isNaN(currentX)) {
        console.warn('Invalid currentX calculated for item:', item.id, 'posX:', posX, 'scrollOffset:', scrollOffset);
        cube.position.set(-200, posY, posZ);
      } else {
        cube.position.set(currentX, posY, posZ);
      }
      cube.userData = {
        isBlock: true,
        item: item,
        originalSize: size,
        originalPosition: originalPosition
      };
      
      // Animate workshare color from white to theme color using CSS-style animation
      if (item.type === 'workshare') {
        const currentColors = getThemeColors(currentTheme);
        const targetColor = new THREE.Color(currentColors.workshare);
        
        // Start with white
        cube.material.color.setHex(0xffffff);
        
        // Animate to target color over 1 second
        const startTime = Date.now();
        const duration = 1000;
        
        const animateColor = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          const white = new THREE.Color(0xffffff);
          const currentColor = white.lerp(targetColor, progress);
          cube.material.color.copy(currentColor);
          
          if (progress < 1) {
            requestAnimationFrame(animateColor);
          }
        };
        
        requestAnimationFrame(animateColor);
      }
      
      // Reposition chain when zone blocks are created (like recenter but no camera move)
      if (item.type === 'block') { // zone blocks
        // Get all blocks with original positions
        const blockChildren = sceneRef.current.children.filter(child => 
          child.userData.isBlock && child.userData.originalPosition
        );
        
        if (blockChildren.length > 0) {
          // Find the range of original X positions
          const originalXPositions = blockChildren.map(child => child.userData.originalPosition.x);
          const minOriginalX = Math.min(...originalXPositions);
          const maxOriginalX = Math.max(...originalXPositions);
          
          // Smooth scroll adjustment to keep newest blocks in view
          // Position newest blocks around x=0 to x=400 in screen space
          const targetScrollOffset = maxOriginalX - 200;
          if (!isNaN(targetScrollOffset)) {
            // Only update target, let animation loop smooth transition
            targetScrollOffsetRef.current = targetScrollOffset;
          } else {
            console.warn('Invalid targetScrollOffset calculated:', targetScrollOffset, 'maxOriginalX:', maxOriginalX);
          }
        }
      }
      
      // Animate new blocks and workshares in Quai theme
      if (currentTheme === 'quai' && currentThemeRef.current && currentThemeRef.current.animateBlock) {
        const chainType = item.type === 'primeBlock' ? 'prime' : 
                         item.type === 'regionBlock' ? 'region' : 
                         item.type === 'block' ? 'zone' : 
                         item.type === 'workshare' ? 'workshare' : item.type;
        currentThemeRef.current.animateBlock(cube, chainType);
      }
      
      // Ensure block is always visible and never culled
      cube.frustumCulled = false;
      cube.visible = true;
      
      // Add text inside the block
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 256;
      
      context.fillStyle = '#ffffff';
      context.font = 'bold 32px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // Add block info text
      const typeLabel = item.type === 'primeBlock' ? 'PRIME' : 
                       item.type === 'regionBlock' ? 'REGION' : 
                       item.type === 'block' ? 'ZONE' : 
                       item.type.toUpperCase();
      const lines = [
        item.hash,
        `#${item.number || 'N/A'}`,
        typeLabel
      ];
      
      // Add chain name for 2x2 mode
      if (mode === '2x2' && item.chainName) {
        lines.push(item.chainName);
      }
      
      lines.forEach((line, index) => {
        context.fillText(line, 128, 85 + (index * 30));
      });
      
      const textTexture = new THREE.CanvasTexture(canvas);
      const textMaterial = new THREE.MeshBasicMaterial({ 
        map: textTexture, 
        transparent: true,
        alphaTest: 0.1
      });
      
      // Create text planes for each face
      const textGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.8);
      
      // Front face
      const textMesh1 = new THREE.Mesh(textGeometry, textMaterial);
      textMesh1.position.set(0, 0, size / 2 + 0.1);
      cube.add(textMesh1);
      
      // Back face  
      const textMesh2 = new THREE.Mesh(textGeometry, textMaterial);
      textMesh2.position.set(0, 0, -size / 2 - 0.1);
      textMesh2.rotation.y = Math.PI;
      cube.add(textMesh2);
      
      const colorHex = material.color.getHexString();
      scene.add(cube);
      blocksAdded++;
    });
        
    // Add connecting lines between blocks with proper hierarchy
    items.forEach(item => {
      // Skip uncles in 2x2 demo mode
      if (mode === '2x2' && item.type === 'uncle') {
        return;
      }
      
      // Handle different types of connections
      let connectionsToMake = [];
      
      if (['primeBlock', 'regionBlock', 'block'].includes(item.type)) {
        // 1. Vertical hierarchy connections (Prime -> Region -> Zone for same hash)
        if (item.type === 'regionBlock') {
          // Region connects down to Zone of same hash
          const zoneBlock = items.find(p => p.fullHash === item.fullHash && p.type === 'block');
          if (zoneBlock) {
            connectionsToMake.push({ parent: item, child: zoneBlock, type: 'hierarchy' });
          }
        }
        if (item.type === 'primeBlock') {
          // Prime connects down to Region of same hash
          const regionBlock = items.find(p => p.fullHash === item.fullHash && p.type === 'regionBlock');
          if (regionBlock) {
            connectionsToMake.push({ parent: item, child: regionBlock, type: 'hierarchy' });
          }
        }
        
        // 2. Horizontal chain connections (same type to parent hash)
        if (item.fullParentHash && 
            item.fullParentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          const parent = items.find(p => p.fullHash === item.fullParentHash && p.type === item.type);
          if (parent && parent.number !== null && item.number !== null) {
            connectionsToMake.push({ parent: parent, child: item, type: 'chain' });
          }
        }
      } else if (item.type === 'workshare' && item.fullParentHash && 
                 item.fullParentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        // Workshare connections to their parent blocks
        const parent = items.find(p => p.fullHash === item.fullParentHash && p.type === 'block');
        if (parent) {
          connectionsToMake.push({ parent: parent, child: item, type: 'workshare' });
        }
      }
      
      // Add inclusion arrows (forward links) for workshares and uncles
      if ((item.type === 'workshare' || item.type === 'uncle') && item.includedIn) {
        const includingBlock = items.find(p => p.fullHash === item.includedIn && p.type === 'block');
        if (includingBlock) {
          connectionsToMake.push({ parent: item, child: includingBlock, type: 'inclusion' });
        }
      }
      
      // Create all the connections
      connectionsToMake.forEach(({ parent, child, type }) => {
        if (parent && child) {
          
          // Find the actual blocks in the scene
          const parentBlock = scene.children.find(sceneChild => 
            sceneChild.userData.isBlock && sceneChild.userData.item.id === parent.id
          );
          const childBlock = scene.children.find(sceneChild => 
            sceneChild.userData.isBlock && sceneChild.userData.item.id === child.id
          );
          
          if (!parentBlock || !childBlock) {
            console.log(`⚠️ Skipping arrow creation - missing blocks. Parent: ${!!parentBlock}, Child: ${!!childBlock}`);
            return; // Skip arrow creation if either block doesn't exist
          }
          
          // Use actual block positions and sizes from the scene
          const getBlockPosition = (block) => {
            return {
              x: block.userData.originalPosition.x,
              y: block.userData.originalPosition.y,
              z: block.userData.originalPosition.z,
              size: block.userData.originalSize
            };
          };
          
          const parentPos = getBlockPosition(parentBlock);
          const childPos = getBlockPosition(childBlock);
          
          // Check if arrow already exists
          const arrowId = `arrow-${parent.id}-${child.id}`;
          const existingArrow = scene.children.find(sceneChild => 
            sceneChild.userData.isArrow && sceneChild.userData.arrowId === arrowId
          );
          
          if (!existingArrow) {
            // Store the positions at creation time to prevent movement later
            let originalPoints;
            
            if (type === 'hierarchy') {
              // Vertical hierarchy connections: Prime -> Region -> Zone (downward)
              // Connect from bottom center of parent to top center of child
              const parentBottomY = parentPos.y - parentPos.size / 2; // Bottom of parent
              const childTopY = childPos.y + childPos.size / 2; // Top of child
              
              originalPoints = [
                new THREE.Vector3(parentPos.x, parentBottomY, parentPos.z),  // Bottom center of parent
                new THREE.Vector3(childPos.x, childTopY, childPos.z)        // Top center of child
              ];
            } else if (type === 'workshare') {
              // Workshare lines: from bottom center of parent block to center-top of workshare
              const parentBottomY = parentPos.y - parentPos.size / 2; // Bottom of parent block
              const workshareTopY = childPos.y + childPos.size / 2; // Top of workshare
              
              originalPoints = [
                new THREE.Vector3(parentPos.x, parentBottomY, parentPos.z),      // Bottom center of parent
                new THREE.Vector3(childPos.x, workshareTopY, childPos.z)        // Center-top of workshare
              ];
            } else if (type === 'inclusion') {
              // Inclusion arrows (forward links): from top center of workshare/uncle to bottom center of including block
              const sourceTopY = parentPos.y + parentPos.size / 2; // Top of workshare/uncle
              const targetBottomY = childPos.y - childPos.size / 2; // Bottom of including block
              
              originalPoints = [
                new THREE.Vector3(parentPos.x, sourceTopY, parentPos.z),         // Top center of source
                new THREE.Vector3(childPos.x, targetBottomY, childPos.z)        // Bottom center of target
              ];
            } else {
              // Horizontal chain connections: connect through the middle (center to center)
              const parentCenterY = parentPos.y; // Center of parent
              const childCenterY = childPos.y;   // Center of child
              
              originalPoints = [
                new THREE.Vector3(parentPos.x + parentPos.size / 2, parentCenterY, parentPos.z), // Right edge center of parent
                new THREE.Vector3(childPos.x - childPos.size / 2, childCenterY, childPos.z)      // Left edge center of child
              ];
            }
            
            // Use absolute positions for arrows (no scroll offset)
            const currentPoints = originalPoints.map(point => 
              new THREE.Vector3(point.x, point.y, point.z)
            );
            
            // Validate both current and original points to prevent NaN errors
            const validCurrentPoints = currentPoints.every(point => 
              !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
            );
            const validOriginalPoints = originalPoints.every(point => 
              !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
            );
            
            if (!validCurrentPoints || !validOriginalPoints) {
              console.warn('Invalid arrow points detected, skipping arrow. Current:', currentPoints, 'Original:', originalPoints);
              return; // Skip this arrow
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(currentPoints);
            // Use white color for inclusion arrows (same as regular arrows)
            const lineColor = config.colors.arrow; // Theme-specific arrow color
            let line;
            if (currentTheme === 'quai' && currentThemeRef.current) {
              // Use Quai theme connection material with glow
              const material = currentThemeRef.current.getConnectionMaterial();
              line = new THREE.Line(geometry, material);
              // Add glow effect
              const glowLine = currentThemeRef.current.createConnectionGlow(geometry);
              if (glowLine) {
                glowLine.userData = { 
                  isArrow: true, 
                  isGlow: true,
                  arrowId: arrowId + '-glow',
                  originalPoints: originalPoints 
                };
                glowLine.frustumCulled = false;
                glowLine.visible = true;
                scene.add(glowLine);
              }
            } else {
              const material = new THREE.LineBasicMaterial({ 
                color: lineColor,
                linewidth: 2, // Note: linewidth > 1 only works on some systems
                depthTest: true,
                depthWrite: true
              });
              line = new THREE.Line(geometry, material);
            }
            line.userData = { 
              isArrow: true, 
              arrowId,
              originalPoints: originalPoints 
            };
            // Ensure arrow is always visible and never culled
            line.frustumCulled = false;
            line.visible = true;
            scene.add(line);
          }
        }
      });
    });
    
    // Generate theme objects if we have a theme active
    if (currentThemeRef.current && currentThemeRef.current.generateSegment) {
      // Calculate segment bounds based on current blocks
      const blockPositions = scene.children
        .filter(child => child.userData.isBlock && child.userData.originalPosition)
        .map(child => child.userData.originalPosition.x);
        
      if (blockPositions.length > 0) {
        const minX = Math.min(...blockPositions) - 500; // Start theme objects a bit before blocks
        const maxX = Math.max(...blockPositions) + 800; // Extend theme objects ahead of blocks
        currentThemeRef.current.generateSegment(minX, maxX, minTimestamp, Date.now(), config.spacing);
      }
    }
    
    // Final render after all arrows are processed
    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.render(scene, cameraRef.current);
    }
    
    // Position camera to show blockchain - only on very first load
    if (!initialCameraSetup && items.length > 0 && cameraRef.current && controlsReady && controlsRef.current) {
      // Use actual block positions to position camera intelligently
      const blockPositions = scene.children
        .filter(child => child.userData.isBlock)
        .map(child => child.position);
        
      if (blockPositions.length > 0) {
        const minX = Math.min(...blockPositions.map(p => p.x));
        const maxX = Math.max(...blockPositions.map(p => p.x));
        const minY = Math.min(...blockPositions.map(p => p.y));
        const maxY = Math.max(...blockPositions.map(p => p.y));
        const minZ = Math.min(...blockPositions.map(p => p.z));
        const maxZ = Math.max(...blockPositions.map(p => p.z));
        
        // Calculate center and required distance to fit all blocks
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const blockSpread = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
        
        // Position camera to match recenter view: side angle, less top-down
        const cameraX = 1000;  // Move camera further left
        const cameraY = 600;   // Lower height for more side view
        const cameraZ = 1500;  // Further back to see more of the chain
        
        cameraRef.current.position.set(cameraX, cameraY, cameraZ);
        controlsRef.current.target.set(0, 0, 0); // Look at center
        controlsRef.current.update();
        
        // Mark initial camera setup as complete
        setInitialCameraSetup(true);
        
        console.log(`📷 Initial camera positioned at (${cameraX}, ${cameraY}, ${cameraZ}) looking at center (0, 0, 0)`);
      }
    }
    }, 100); // 100ms debounce
    
    // Cleanup function
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [items, config, sceneReady, controlsReady]);

  // 3D Legend and UI overlays can be added here later
  // For now, we'll rely on the HTML UI controls

  return (
    <div className="chain-visualizer">
      <div
        ref={mountRef}
        className="visualizer-3d"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Theme selector and controls */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid rgba(204, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '4px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          <label style={{ color: '#ffffff', fontSize: '12px', marginRight: '8px', fontWeight: '500' }}>
            Theme:
          </label>
          <select
            value={currentTheme}
            onChange={(e) => {
              console.log('Dropdown onChange triggered with value:', e.target.value);
              setUserSelectedTheme(true);
              console.log('Setting currentTheme directly to:', e.target.value);
              setCurrentTheme(e.target.value);
            }}
            style={{
              background: 'transparent',
              color: '#ffffff',
              border: '1px solid rgba(204, 0, 0, 0.3)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'linear-gradient(135deg, rgba(204, 0, 0, 0.2) 0%, rgba(153, 0, 0, 0.2) 100%)';
              e.target.style.borderColor = 'rgba(204, 0, 0, 0.5)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.borderColor = 'rgba(204, 0, 0, 0.3)';
              e.target.style.color = '#ffffff';
            }}
          >
            {Object.entries(themeConfigs).map(([key, config]) => (
              <option key={key} value={key} style={{ background: '#1a0505' }}>
                {config.name}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => {
            // Recenter the scene by resetting scroll offset to show newest blocks
            if (sceneRef.current) {
              // Find the rightmost (newest) block position
              let maxOriginalX = -Infinity;
              let minOriginalX = Infinity;
              let blockCount = 0;
              
              sceneRef.current.children.forEach(child => {
                if (child.userData.isBlock && child.userData.originalPosition) {
                  maxOriginalX = Math.max(maxOriginalX, child.userData.originalPosition.x);
                  minOriginalX = Math.min(minOriginalX, child.userData.originalPosition.x);
                  blockCount++;
                }
              });
              
              if (blockCount > 0 && cameraRef.current && controlsRef.current) {
                // Calculate the center of all blocks
                const centerX = (maxOriginalX + minOriginalX) / 2;
                
                // Set initial scroll offset to center the blocks
                const initialScrollOffset = maxOriginalX - 400;
                scrollOffsetRef.current = initialScrollOffset; // Direct set for initial positioning
                targetScrollOffsetRef.current = initialScrollOffset;
                
                // Position camera to view the centered scene from side angle, less top-down
                const cameraX = 1000;  // Move camera further left
                const cameraY = 600;   // Lower height for more side view
                const cameraZ = 1500;  // Further back to see more of the chain
                
                // Temporarily disable controls to prevent interaction detection
                const wasEnabled = controlsRef.current.enabled;
                controlsRef.current.enabled = false;
                
                cameraRef.current.position.set(cameraX, cameraY, cameraZ);
                controlsRef.current.target.set(0, 0, 0); // Look at center
                controlsRef.current.update();
                
                // Re-enable controls
                controlsRef.current.enabled = wasEnabled;
                
                console.log(`🎯 Recentered scene with ${blockCount} blocks`);
              }
            }
          }}
          style={{
            background: 'transparent',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'linear-gradient(135deg, rgba(204, 0, 0, 0.2) 0%, rgba(153, 0, 0, 0.2) 100%)';
            e.target.style.color = '#ffffff';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#ffffff';
          }}
        >
          Recenter
        </button>
      </div>
      
      {/* Navigation instructions */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid rgba(204, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          zIndex: 1000,
          fontSize: '11px',
          color: '#ffffff',
          maxWidth: '200px'
        }}
      >
        <div style={{ fontWeight: '600', marginBottom: '8px' }}>Navigation</div>
        <div style={{ lineHeight: '1.4' }}>
          <div>• Left drag: Rotate view</div>
          <div>• Right drag: Pan camera</div>
          <div>• Scroll: Zoom in/out</div>
          {mode === 'mainnet' && <div>• Click block: Open in QuaiScan</div>}
          {mode === '2x2' && <div>• Click block: View demo data</div>}
        </div>
      </div>
      
      {/* Legend - only show for normal theme */}
      {currentTheme === 'normal' && (
        <div
          style={{
            position: 'absolute',
            top: '180px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid rgba(204, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            zIndex: 1000,
            fontSize: '11px',
            color: '#ffffff'
          }}
        >
        <div style={{ fontWeight: '600', marginBottom: '8px' }}>
          {mode === '2x2' ? '2x2 Hierarchy' : 'Legend'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#F44336', marginRight: '8px', borderRadius: '2px' }}></div>
          <span>Prime</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#FFEB3B', marginRight: '8px', borderRadius: '2px' }}></div>
          <span>Region {mode === '2x2' ? '(2)' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#4CAF50', marginRight: '8px', borderRadius: '2px' }}></div>
          <span>Zone {mode === '2x2' ? '(4)' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#2196F3', marginRight: '8px', borderRadius: '2px' }}></div>
          <span>Workshare</span>
        </div>
        {mode !== '2x2' && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#FF9800', marginRight: '8px', borderRadius: '2px' }}></div>
            <span>Uncle</span>
          </div>
        )}
        {mode === '2x2' && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Chains spread in Z-axis:<br/>
              Prime: Center<br/>
              Regions: Left/Right<br/>
              Zones: Outer edges
            </div>
          </div>
        )}
        </div>
      )}
      
      {tooltip.visible && (
        <div
          className="block-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'pre-line'
          }}
        >
          {tooltip.content}
        </div>
      )}
      
      {/* Floating mute button inside the visualizer */}
      <button
        onClick={() => {
          setAudioEnabled(!audioEnabled);
          if (!audioEnabled && userInteracted) {
            playThemeMusic(currentTheme);
          } else {
            stopThemeMusic();
          }
        }}
        className="mute-button-3d"
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          background: audioEnabled ? 'rgba(204, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.8)',
          color: '#ffffff',
          border: '2px solid rgba(204, 0, 0, 0.6)',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          fontSize: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          padding: '0',
          outline: 'none',
          transition: 'all 0.3s ease'
        }}
        title={audioEnabled ? 'Mute' : 'Unmute'}
      >
        {audioEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  );
});

export default ChainVisualizer;