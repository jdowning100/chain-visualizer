import * as THREE from 'three';

export default class QuaiTheme {
  constructor(scene) {
    this.scene = scene;
    this.animatedBlocks = new Map();
    this.textureLoader = new THREE.TextureLoader();
    this.clock = new THREE.Clock();
  }

  init() {
    // Keep original dark background
    this.scene.background = new THREE.Color(0x1a1a1a);
    
    // Basic ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // Basic directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }
  
  
  getBlockMaterial(chainType, isUncle = false) {
    // Base glass-like material properties
    const baseMaterial = {
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    };
    
    // Colors matching the reference image - deeper red tones
    let color, emissive;
    switch(chainType) {
      case 'prime':
        color = 0xcc2200;  // Deep red
        emissive = 0x881100;
        break;
      case 'region':
        color = 0xdd3300;  // Red-orange
        emissive = 0xaa1100;
        break;
      case 'zone':
        color = 0xdd3300;  // Red-orange (same as region for consistency)
        emissive = 0xaa1100;
        break;
      default:
        color = 0xcc2200;
        emissive = 0x881100;
    }
    
    if (isUncle) {
      color = 0xbb1100;
      emissive = 0x660000;
    }
    
    return new THREE.MeshPhysicalMaterial({
      ...baseMaterial,
      color: color,
      emissive: emissive,
      emissiveIntensity: 0.3
    });
  }
  
  getWorkShareMaterial() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffaa44,
      emissiveIntensity: 0.6,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.8,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
  }
  
  createBlockTexture(size = 256, progress = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // If progress is complete, return empty texture
    if (progress >= 1.0) {
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    }
    
    // Create grid pattern that gets progressively smaller and fades out
    const baseSquareSize = size / 6; // Start with larger squares
    const currentSquareSize = baseSquareSize * (1 - progress * 0.9); // Shrink to almost nothing
    const spacing = baseSquareSize * 1.4;
    const opacity = (1 - progress) * 0.9; // Fade out completely
    
    // Only draw if there's something meaningful to show
    if (currentSquareSize > 1 && opacity > 0.05) {
      // White squares
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      
      // Create regular grid
      for (let x = spacing/2; x < size; x += spacing) {
        for (let y = spacing/2; y < size; y += spacing) {
          ctx.fillRect(
            x - currentSquareSize/2, 
            y - currentSquareSize/2, 
            currentSquareSize, 
            currentSquareSize
          );
        }
      }
      
      // Add border lines for definition (only when squares are large enough)
      if (currentSquareSize > 3) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
        ctx.lineWidth = 1;
        for (let x = spacing/2; x < size; x += spacing) {
          for (let y = spacing/2; y < size; y += spacing) {
            ctx.strokeRect(
              x - currentSquareSize/2, 
              y - currentSquareSize/2, 
              currentSquareSize, 
              currentSquareSize
            );
          }
        }
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(1, 1);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
  
  animateBlock(block, chainType) {
    const startTime = Date.now();
    
    // Set initial bright white-orange color (more filled appearance)
    block.material.color.setHex(0xffeeaa);
    block.material.emissive.setHex(0xffcc88);
    block.material.emissiveIntensity = 0.6;
    
    // Set initial opacity to be more solid
    block.material.opacity = 0.9;
    block.material.transparent = true;
    
    // Create and apply initial texture with squares
    const initialTexture = this.createBlockTexture(256, 0);
    block.material.map = initialTexture;
    block.material.needsUpdate = true;
    
    // Store animation data
    this.animatedBlocks.set(block, {
      startTime,
      chainType
    });
    
    // Add initial bright white-orange glow
    const glowGeometry = new THREE.BoxGeometry(
      block.geometry.parameters.width * 1.15,
      block.geometry.parameters.height * 1.15,
      block.geometry.parameters.depth * 1.15
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcc88,
      transparent: false,
      opacity: 0.8,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    block.add(glow);
    block.userData.glow = glow;
  }
  
  updateAnimations() {
    this.update();
  }
  
  update() {
    const currentTime = Date.now();
    for (const [block, data] of this.animatedBlocks) {
      const elapsed = (currentTime - data.startTime) / 1000;
      const progress = Math.min(elapsed / 3, 1); // 3 second animation
      
      // All blocks use the same color progression: white -> orange -> red
      const finalRedColor = new THREE.Color(0xdd2200); // Final red for all blocks
      const finalRedEmissive = new THREE.Color(0x881100);
      
      let currentColor, currentEmissive;
      
      if (progress < 0.5) {
        // First half: white-orange -> bright full orange (0 to 0.5 progress)
        const halfProgress = progress * 2; // 0 to 1
        const startColor = new THREE.Color(0xffeeaa); // Warm white-orange
        const midColor = new THREE.Color(0xff8833); // Bright vibrant orange
        const startEmissive = new THREE.Color(0xffcc88); // Warm emissive
        const midEmissive = new THREE.Color(0xff6622); // Strong orange emissive
        
        currentColor = startColor.clone().lerp(midColor, halfProgress);
        currentEmissive = startEmissive.clone().lerp(midEmissive, halfProgress);
      } else {
        // Second half: bright orange -> deep red (0.5 to 1.0 progress)
        const halfProgress = (progress - 0.5) * 2; // 0 to 1
        const midColor = new THREE.Color(0xff8833); // Bright orange
        const midEmissive = new THREE.Color(0xff6622); // Strong orange emissive
        
        currentColor = midColor.clone().lerp(finalRedColor, halfProgress);
        currentEmissive = midEmissive.clone().lerp(finalRedEmissive, halfProgress);
      }
      
      block.material.color.copy(currentColor);
      block.material.emissive.copy(currentEmissive);
      
      // Emissive intensity peaks during orange phase then reduces
      if (progress < 0.5) {
        // Increase intensity during orange phase
        block.material.emissiveIntensity = 0.6 + (progress * 0.4); // 0.6 to 1.0
      } else {
        // Reduce intensity during red phase
        block.material.emissiveIntensity = 1.0 - ((progress - 0.5) * 0.7); // 1.0 to 0.3
      }
      
      // Create and update texture that shrinks over time
      if (progress < 0.9) {
        // Show texture during first 90% of animation
        const texture = this.createBlockTexture(256, progress);
        block.material.map = texture;
      } else {
        // Remove texture in final 10% for completely smooth finish
        block.material.map = null;
      }
      block.material.needsUpdate = true;
      
      // Fade out glow over entire animation
      if (block.userData.glow) {
        const glowOpacity = 0.6 * (1 - progress);
        block.userData.glow.material.opacity = glowOpacity;
        // Glow color changes with main color
        if (progress < 0.5) {
          // White-orange to bright orange glow
          const glowProgress = progress * 2;
          const startGlow = new THREE.Color(0xffcc88);
          const midGlow = new THREE.Color(0xff8833);
          block.userData.glow.material.color.lerpColors(startGlow, midGlow, glowProgress);
        } else {
          // Bright orange to deep red glow
          const glowProgress = (progress - 0.5) * 2;
          const midGlow = new THREE.Color(0xff8833);
          const endGlow = new THREE.Color(0xdd2200);
          block.userData.glow.material.color.lerpColors(midGlow, endGlow, glowProgress);
        }
        // Slight scale reduction as glow fades
        block.userData.glow.scale.setScalar(1 + 0.15 * (1 - progress));
      }
      
      // Start with higher opacity and gradually adjust for consistent fullness
      const initialOpacity = 0.9; // Start more solid
      const finalOpacity = 0.85; // Target glass opacity
      
      if (progress < 0.5) {
        // Maintain high opacity during orange phase
        block.material.opacity = initialOpacity;
        // Minimal glass properties during orange phase
        block.material.transmission = progress * 0.2;
        block.material.thickness = progress * 0.4;
      } else {
        // Slight opacity adjustment during red phase
        const redProgress = (progress - 0.5) * 2;
        block.material.opacity = initialOpacity - (redProgress * (initialOpacity - finalOpacity));
        // Enhance glass properties during red phase
        block.material.transmission = 0.2 + (redProgress * 0.3);
        block.material.thickness = 0.4 + (redProgress * 0.8);
      }
      
      // Clean up completed animations
      if (progress >= 1) {
        if (block.userData.glow) {
          block.remove(block.userData.glow);
          block.userData.glow = null;
        }
        // Ensure texture is completely removed for solid red cube
        block.material.map = null;
        block.material.needsUpdate = true;
        this.animatedBlocks.delete(block);
      }
    }
  }
  
  getConnectionMaterial() {
    return new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
  }
  
  createConnectionGlow(geometry) {
    const glowMaterial = new THREE.LineBasicMaterial({
      color: 0xff3333,
      linewidth: 8,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Line(geometry, glowMaterial);
  }
  
  getColors() {
    return {
      prime: 0xff6633,
      region: 0xffaa33,
      zone: 0xff8833,
      workshare: 0xffffff,
      uncle: 0xff5500,
      connection: 0xff0000
    };
  }
  
  cleanup() {
    // Clean up any theme-specific resources
    // Remove glow effects from all animated blocks
    for (const [block, data] of this.animatedBlocks) {
      if (block.userData.glow) {
        block.remove(block.userData.glow);
        if (block.userData.glow.geometry) block.userData.glow.geometry.dispose();
        if (block.userData.glow.material) block.userData.glow.material.dispose();
        block.userData.glow = null;
      }
      
      // Remove textures
      if (block.material && block.material.map) {
        block.material.map = null;
        block.material.needsUpdate = true;
      }
    }
    
    this.animatedBlocks.clear();
  }
}