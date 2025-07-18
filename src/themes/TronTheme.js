import * as THREE from 'three';

export class TronTheme {
  constructor(scene) {
    this.scene = scene;
    this.lastSegmentX = 0;
    this.segmentWidth = 2000;
    this.gridLines = [];
    this.lightCycles = [];
    this.lastLightCycleTime = 0;
    this.floorSegments = []; // Track individual floor segments
    this.lastFloorSegmentX = 0;
    this.floorSegmentWidth = 4000; // Larger segments for floor
    
    // Store original background to restore later
    this.originalBackground = scene.background;
    
    // Create Tron-style environment
    this.createTronBackground();
    this.createInitialTronGrid();
    this.createTronLighting();
  }

  createTronBackground() {
    // Create a deep digital blue background with subtle gradient
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // Create gradient with classic Tron blue
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#001133');    // Dark blue at top
    gradient.addColorStop(0.5, '#002255'); // Medium blue in middle
    gradient.addColorStop(1, '#003377');   // Brighter blue at bottom
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    // Add subtle digital noise pattern with cyan
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const brightness = Math.random() * 0.3;
      context.fillStyle = `rgba(0, 212, 255, ${brightness})`; // Classic Tron cyan noise
      context.fillRect(x, y, 1, 1);
    }
    
    // Create texture and set as scene background
    const texture = new THREE.CanvasTexture(canvas);
    texture.userData = { isTronBackground: true };
    this.scene.background = texture;
  }

  createInitialTronGrid() {
    // Create initial floor segments around the origin
    for (let x = -8000; x <= 8000; x += this.floorSegmentWidth) {
      this.createFloorSegment(x);
    }
    this.lastFloorSegmentX = 8000;
  }

  createFloorSegment(centerX) {
    const segmentGroup = new THREE.Group();
    const segmentSize = this.floorSegmentWidth;
    const divisions = 20; // Fewer divisions per segment for performance
    
    // Create transparent glass floor plane for this segment
    const floorGeometry = new THREE.PlaneGeometry(segmentSize, segmentSize);
    const floorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x001122,
      transparent: true,
      opacity: 0.1,
      roughness: 0.0,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      reflectivity: 1.0,
      side: THREE.DoubleSide
    });
    const glassFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    glassFloor.rotation.x = -Math.PI / 2;
    glassFloor.position.set(centerX, -1200, 0);
    segmentGroup.add(glassFloor);
    
    // Create main grid lines (bright cyan) for this segment
    const gridHelper = new THREE.GridHelper(segmentSize, divisions, 0x00ffff, 0x004488);
    gridHelper.position.set(centerX, -1199, 0); // Slightly above glass floor
    segmentGroup.add(gridHelper);
    
    // Add finer grid lines (dimmer cyan/blue) for this segment
    const fineGridHelper = new THREE.GridHelper(segmentSize, divisions * 2, 0x0088cc, 0x002244);
    fineGridHelper.position.set(centerX, -1198, 0); // Above main grid
    segmentGroup.add(fineGridHelper);
    
    segmentGroup.userData = { 
      isTronFloorSegment: true, 
      segmentCenterX: centerX 
    };
    this.scene.add(segmentGroup);
    this.floorSegments.push(segmentGroup);
    
    return segmentGroup;
  }


  createTronLighting() {
    // Brighter ambient lighting with Tron blue tint for overhead view
    const ambientLight = new THREE.AmbientLight(0x002255, 0.6);
    ambientLight.userData = { isTronLighting: true };
    this.scene.add(ambientLight);
    
    // Main directional light from above with cyan tint
    const directionalLight = new THREE.DirectionalLight(0x44aaff, 1.0);
    directionalLight.position.set(0, 2000, 0); // Directly overhead
    directionalLight.castShadow = true;
    directionalLight.userData = { isTronLighting: true };
    this.scene.add(directionalLight);
    
    // Add some rim lighting from the sides for depth
    const rimLight1 = new THREE.DirectionalLight(0x2266aa, 0.3);
    rimLight1.position.set(3000, 500, 1000);
    rimLight1.userData = { isTronLighting: true };
    this.scene.add(rimLight1);
    
    const rimLight2 = new THREE.DirectionalLight(0x2266aa, 0.3);
    rimLight2.position.set(-3000, 500, -1000);
    rimLight2.userData = { isTronLighting: true };
    this.scene.add(rimLight2);
  }

  createLightCycle(x, y, z) {
    const lightCycle = new THREE.Group();
    
    // Main body (sleek futuristic design)
    const bodyGeometry = new THREE.BoxGeometry(20, 8, 40);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x003366,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x001122
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    lightCycle.add(body);
    
    // Glowing light trails - longer and brighter for overhead view
    const trailGeometry = new THREE.PlaneGeometry(8, 400);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.position.set(0, 2, -200); // Above the cycle, longer trail
    trail.rotation.x = -Math.PI / 2; // Lay flat on ground
    trail.userData = { isLightTrail: true };
    lightCycle.add(trail);
    
    // Wheels with glow
    for (let i = 0; i < 2; i++) {
      const wheelGeometry = new THREE.CylinderGeometry(6, 6, 3, 16);
      const wheelMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.8
      });
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(i === 0 ? -12 : 12, -6, 0);
      wheel.rotation.z = Math.PI / 2;
      lightCycle.add(wheel);
    }
    
    lightCycle.position.set(x, y, z);
    
    // Random velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 40,
      0,
      (Math.random() - 0.5) * 40
    );
    
    lightCycle.userData = {
      isLightCycle: true,
      velocity: velocity,
      life: 1.0
    };
    
    return lightCycle;
  }

  createTronDisc(x, y, z) {
    const disc = new THREE.Group();
    
    // Main disc geometry
    const discGeometry = new THREE.CylinderGeometry(15, 15, 3, 32);
    const discMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.8
    });
    const discMesh = new THREE.Mesh(discGeometry, discMaterial);
    disc.add(discMesh);
    
    // Glowing edge
    const edgeGeometry = new THREE.TorusGeometry(15, 1, 8, 32);
    const edgeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x44ccff,
      transparent: true,
      opacity: 0.9
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.rotation.x = Math.PI / 2;
    disc.add(edge);
    
    disc.position.set(x, y, z);
    disc.userData = {
      isTronDisc: true,
      rotationSpeed: 0.05 + Math.random() * 0.05
    };
    
    return disc;
  }

  createDataStream(x, y, z) {
    const stream = new THREE.Group();
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(1, 8, 8);
      const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: Math.random() > 0.5 ? 0x00d4ff : 0x0099cc, // Classic Tron cyan and blue
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(
        (Math.random() - 0.5) * 100,
        i * 10,
        (Math.random() - 0.5) * 50
      );
      stream.add(particle);
    }
    
    stream.position.set(x, y, z);
    stream.userData = {
      isDataStream: true,
      flowSpeed: 2 + Math.random() * 3
    };
    
    return stream;
  }

  generateSegment(minX, maxX, minTimestamp, currentTimestamp, spacing) {
    const segments = Math.ceil((maxX - this.lastSegmentX) / this.segmentWidth);
    
    // Generate floor segments for the expanded area
    const floorSegmentsNeeded = Math.ceil((maxX - this.lastFloorSegmentX) / this.floorSegmentWidth);
    for (let i = 0; i < floorSegmentsNeeded; i++) {
      const floorX = this.lastFloorSegmentX + (i + 1) * this.floorSegmentWidth;
      this.createFloorSegment(floorX);
    }
    this.lastFloorSegmentX = this.lastFloorSegmentX + floorSegmentsNeeded * this.floorSegmentWidth;
    
    for (let seg = 0; seg < segments; seg++) {
      const segmentX = this.lastSegmentX + (seg + 1) * this.segmentWidth;
      
      // Add Tron discs
      for (let i = 0; i < 2 + Math.random() * 3; i++) {
        const disc = this.createTronDisc(
          segmentX + (Math.random() - 0.5) * this.segmentWidth,
          (Math.random() > 0.5 ? 1 : -1) * (400 + Math.random() * 400),
          (Math.random() > 0.5 ? 1 : -1) * (800 + Math.random() * 600)
        );
        this.scene.add(disc);
      }
      
      // Add data streams
      if (Math.random() < 0.3) {
        const dataStream = this.createDataStream(
          segmentX + (Math.random() - 0.5) * this.segmentWidth,
          (Math.random() - 0.5) * 600,
          (Math.random() > 0.5 ? 1 : -1) * (600 + Math.random() * 400)
        );
        this.scene.add(dataStream);
      }
      
      // Add light cycles occasionally on the race floor
      if (Math.random() < 0.1) {
        const lightCycle = this.createLightCycle(
          segmentX + (Math.random() - 0.5) * this.segmentWidth,
          -1190, // On the grid floor level
          (Math.random() > 0.5 ? 1 : -1) * (400 + Math.random() * 800)
        );
        this.scene.add(lightCycle);
        this.lightCycles.push(lightCycle);
      }
    }
    
    this.lastSegmentX = this.lastSegmentX + segments * this.segmentWidth;
  }

  updateAnimations(cameraX = 0) {
    const now = Date.now();
    
    // Create light cycles occasionally on the race floor
    if (now - this.lastLightCycleTime > 15000 + Math.random() * 10000) {
      const lightCycle = this.createLightCycle(
        (Math.random() - 0.5) * 4000, // Wider spawn range
        -1190, // On the grid floor level
        (Math.random() > 0.5 ? 1 : -1) * (1200 + Math.random() * 1000)
      );
      this.scene.add(lightCycle);
      this.lightCycles.push(lightCycle);
      this.lastLightCycleTime = now;
      
      // Limit number of light cycles
      if (this.lightCycles.length > 3) {
        const oldCycle = this.lightCycles.shift();
        this.scene.remove(oldCycle);
        oldCycle.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    }
    
    // Update all Tron objects
    this.scene.children.forEach(child => {
      // Animate Tron discs
      if (child.userData.isTronDisc) {
        child.rotation.y += child.userData.rotationSpeed;
        
        // Pulsing glow effect
        const time = Date.now() * 0.003;
        const pulse = Math.sin(time) * 0.2 + 0.8;
        child.children.forEach(part => {
          if (part.material) {
            part.material.opacity = pulse * 0.8;
          }
        });
      }
      
      // Animate data streams
      if (child.userData.isDataStream) {
        const flowSpeed = child.userData.flowSpeed;
        child.children.forEach((particle, index) => {
          particle.position.y += flowSpeed;
          if (particle.position.y > 500) {
            particle.position.y = -500;
          }
          
          // Twinkling effect
          const time = Date.now() * 0.005 + index;
          particle.material.opacity = Math.sin(time) * 0.3 + 0.7;
        });
      }
      
      // Animate light cycles
      if (child.userData.isLightCycle && child.userData.velocity) {
        child.position.add(child.userData.velocity);
        child.lookAt(child.position.clone().add(child.userData.velocity));
        
        // Fade out over time
        child.userData.life -= 0.001;
        child.children.forEach(part => {
          if (part.userData.isLightTrail) {
            const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
            part.material.opacity = pulse * 0.4 * child.userData.life;
          }
        });
        
        // Remove when too far or faded
        if (child.position.length() > 6000 || child.userData.life <= 0) {
          this.scene.remove(child);
          child.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          });
          
          const index = this.lightCycles.findIndex(cycle => cycle === child);
          if (index !== -1) {
            this.lightCycles.splice(index, 1);
          }
        }
      }
    });
    
    // Clean up theme objects that are far behind the camera
    if (cameraX > 0) {
      const toRemove = [];
      this.scene.children.forEach(child => {
        if (child.userData.isTronDisc || child.userData.isDataStream) {
          const distanceBehindCamera = cameraX - child.position.x;
          if (distanceBehindCamera > 6000) { // Remove objects far behind camera (increased for more scene)
            toRemove.push(child);
          }
        }
        // Clean up floor segments that are far behind
        if (child.userData.isTronFloorSegment) {
          const distanceBehindCamera = cameraX - child.userData.segmentCenterX;
          if (distanceBehindCamera > 12000) { // Keep floor segments longer than other objects
            toRemove.push(child);
            // Remove from tracking array
            const index = this.floorSegments.findIndex(segment => segment === child);
            if (index !== -1) {
              this.floorSegments.splice(index, 1);
            }
          }
        }
      });
      
      // Remove old theme objects
      toRemove.forEach(object => {
        this.scene.remove(object);
        object.traverse((child) => {
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
  }

  cleanup() {
    // Restore original background
    if (this.originalBackground !== undefined) {
      this.scene.background = this.originalBackground;
    }
    
    // Dispose of Tron background texture
    if (this.scene.background && this.scene.background.userData && this.scene.background.userData.isTronBackground) {
      this.scene.background.dispose();
    }
    
    // Clean up all Tron theme objects - collect first, then remove to avoid iteration issues
    const toRemove = [];
    this.scene.children.forEach(child => {
      if (child.userData.isTronGrid || child.userData.isTronLighting || 
          child.userData.isTronDisc || child.userData.isDataStream || 
          child.userData.isLightCycle || child.userData.isTronFloorSegment) {
        toRemove.push(child);
      }
    });
    
    // Remove collected objects
    toRemove.forEach(child => {
      this.scene.remove(child);
      child.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    });
    this.lightCycles = [];
    this.floorSegments = [];
  }
}