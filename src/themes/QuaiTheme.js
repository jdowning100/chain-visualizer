import * as THREE from 'three';

export default class QuaiTheme {
  constructor(scene) {
    this.scene = scene;
    this.animatedBlocks = new Map();
    this.textureLoader = new THREE.TextureLoader();
    this.clock = new THREE.Clock();
    this.terrain = null;
    this.rocks = [];
    this.dustParticles = null;
    this.mountains = [];
    this.cityStructures = [];
    this.cityLights = [];
  }

  init() {
    // Mars sky color - dusty reddish atmosphere
    this.scene.background = new THREE.Color(0x331100);
    
    // Add fog for Mars atmosphere
    this.scene.fog = new THREE.FogExp2(0x663322, 0.00008);
    
    // Bright Mars ambient light for sunny day
    const ambientLight = new THREE.AmbientLight(0xffaa88, 0.7);
    this.scene.add(ambientLight);
    
    // Strong sun light on Mars - bright yellow/white
    const directionalLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    directionalLight.position.set(200, 500, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 3000;
    directionalLight.shadow.camera.left = -1000;
    directionalLight.shadow.camera.right = 1000;
    directionalLight.shadow.camera.top = 1000;
    directionalLight.shadow.camera.bottom = -1000;
    directionalLight.shadow.bias = -0.001;
    directionalLight.shadow.normalBias = 0.02;
    this.scene.add(directionalLight);
    
    // Add fill light to reduce shadows
    const fillLight = new THREE.DirectionalLight(0xffccaa, 0.5);
    fillLight.position.set(-100, 300, -100);
    this.scene.add(fillLight);
    
    // Create Mars terrain
    this.createMarsTerrain();
    
    // Add rocky formations
    this.createRocks();
    
    // Add dust particles
    this.createDustEffect();
    
    // Create background mountains
    this.createMountains();
    
    // Create Mars city in the distance
    this.createMarsCity();
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
    
    // Varied red shades for different chain types
    let color, emissive;
    switch(chainType) {
      case 'prime':
        color = 0xff1100;  // Bright pure red
        emissive = 0xcc0000;
        break;
      case 'region':
        color = 0xff4422;  // Red-orange
        emissive = 0xdd2200;
        break;
      case 'zone':
        color = 0xff6644;  // Light red-orange
        emissive = 0xee3311;
        break;
      default:
        color = 0xff3333;  // Medium red
        emissive = 0xdd1111;
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
      color: 0xffccaa,
      emissive: 0xff8866,
      emissiveIntensity: 0.7,
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
  
  
  update() {
    const currentTime = Date.now();
    for (const [block, data] of this.animatedBlocks) {
      const elapsed = (currentTime - data.startTime) / 1000;
      const progress = Math.min(elapsed / 3, 1); // 3 second animation
      
      // Different final colors based on chain type
      let finalRedColor, finalRedEmissive;
      switch(data.chainType) {
        case 'prime':
          finalRedColor = new THREE.Color(0xff1100); // Bright pure red
          finalRedEmissive = new THREE.Color(0xcc0000);
          break;
        case 'region':
          finalRedColor = new THREE.Color(0xff4422); // Red-orange
          finalRedEmissive = new THREE.Color(0xdd2200);
          break;
        case 'zone':
          finalRedColor = new THREE.Color(0xff6644); // Light red-orange
          finalRedEmissive = new THREE.Color(0xee3311);
          break;
        case 'workshare':
          finalRedColor = new THREE.Color(0xffaa88); // Peachy red
          finalRedEmissive = new THREE.Color(0xff7755);
          break;
        default:
          finalRedColor = new THREE.Color(0xff3333); // Medium red
          finalRedEmissive = new THREE.Color(0xdd1111);
      }
      
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
          // Bright orange to chain-specific red glow
          const glowProgress = (progress - 0.5) * 2;
          const midGlow = new THREE.Color(0xff8833);
          let endGlow;
          switch(data.chainType) {
            case 'prime':
              endGlow = new THREE.Color(0xff1100);
              break;
            case 'region':
              endGlow = new THREE.Color(0xff4422);
              break;
            case 'zone':
              endGlow = new THREE.Color(0xff6644);
              break;
            case 'workshare':
              endGlow = new THREE.Color(0xffaa88);
              break;
            default:
              endGlow = new THREE.Color(0xff3333);
          }
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
  
  createMarsTerrain() {
    // Create massive terrain plane with displacement
    const terrainGeometry = new THREE.PlaneGeometry(60000, 60000, 256, 256);
    
    // Add height variation to simulate Mars terrain
    const vertices = terrainGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      
      // Create rolling hills and valleys with larger scale
      let height = Math.sin(x * 0.0003) * 150 + Math.cos(y * 0.0003) * 100;
      height += Math.sin(x * 0.0007) * 50 + Math.cos(y * 0.0007) * 30;
      
      // Add smaller detail noise
      height += (Math.random() - 0.5) * 20;
      
      // Create some large crater-like depressions
      const dist1 = Math.sqrt((x - 5000) * (x - 5000) + (y - 3000) * (y - 3000));
      if (dist1 < 2000) {
        height -= (1 - dist1 / 2000) * 200;
      }
      
      const dist2 = Math.sqrt((x + 7000) * (x + 7000) + (y + 4000) * (y + 4000));
      if (dist2 < 1500) {
        height -= (1 - dist2 / 1500) * 150;
      }
      
      const dist3 = Math.sqrt((x - 12000) * (x - 12000) + (y + 8000) * (y + 8000));
      if (dist3 < 3000) {
        height -= (1 - dist3 / 3000) * 250;
      }
      
      vertices[i + 2] = height;
    }
    
    terrainGeometry.computeVertexNormals();
    
    // Mars surface material
    const terrainMaterial = new THREE.MeshLambertMaterial({
      color: 0xbb4422,
      emissive: 0x331100,
      emissiveIntensity: 0.2
    });
    
    this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.position.y = -600;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }
  
  createRocks() {
    // Add various rock formations
    const rockGeometries = [
      new THREE.DodecahedronGeometry(40, 0),
      new THREE.OctahedronGeometry(50, 0),
      new THREE.TetrahedronGeometry(60, 0)
    ];
    
    const rockMaterial = new THREE.MeshLambertMaterial({
      color: 0x994422,
      emissive: 0x220800,
      emissiveIntensity: 0.1
    });
    
    // Place many more rocks across the expanded terrain
    for (let i = 0; i < 200; i++) {
      const geometry = rockGeometries[Math.floor(Math.random() * rockGeometries.length)];
      const rock = new THREE.Mesh(geometry, rockMaterial);
      
      // Random position across much wider area
      rock.position.set(
        (Math.random() - 0.5) * 40000,
        -580 + Math.random() * 20,
        (Math.random() - 0.5) * 40000
      );
      
      // Random rotation and scale
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      rock.scale.setScalar(1 + Math.random() * 3);
      
      rock.castShadow = true;
      rock.receiveShadow = true;
      
      this.rocks.push(rock);
      this.scene.add(rock);
    }
  }
  
  createDustEffect() {
    // Create floating dust particles
    const particleCount = 5000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 40000;
      positions[i + 1] = -550 + Math.random() * 2000;
      positions[i + 2] = (Math.random() - 0.5) * 40000;
      
      // Reddish-orange dust colors
      const brightness = 0.5 + Math.random() * 0.5;
      colors[i] = brightness * 0.9;     // R
      colors[i + 1] = brightness * 0.4; // G
      colors[i + 2] = brightness * 0.2; // B
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }
  
  updateAnimations() {
    this.update();
    
    // Animate dust particles
    if (this.dustParticles) {
      const time = this.clock.getElapsedTime();
      this.dustParticles.rotation.y = time * 0.02;
      
      // Move dust particles
      const positions = this.dustParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += Math.sin(time + i) * 0.5;
        positions[i + 2] += Math.cos(time + i) * 0.3;
        
        // Wrap around the much larger area
        if (positions[i] > 20000) positions[i] = -20000;
        if (positions[i] < -20000) positions[i] = 20000;
        if (positions[i + 2] > 20000) positions[i + 2] = -20000;
        if (positions[i + 2] < -20000) positions[i + 2] = 20000;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate city lights
    const time = this.clock.getElapsedTime();
    this.cityLights.forEach((light, index) => {
      if (light.type === 'PointLight') {
        // Pulse city point lights
        light.intensity = 1 + Math.sin(time * 2 + index) * 0.3;
      } else if (light.material) {
        // Flicker building lights
        light.material.opacity = 0.3 + Math.sin(time * 3 + index * 0.5) * 0.1;
      }
    });
  }
  
  createMountains() {
    // Create mountain range using cone geometries positioned behind chain
    const mountainMaterial = new THREE.MeshLambertMaterial({
      color: 0x883322,
      emissive: 0x220800,
      emissiveIntensity: 0.1
    });
    
    // Create a line of mountains directly behind the blockchain visualization
    for (let i = 0; i < 15; i++) {
      const height = 1000 + Math.random() * 2000;
      const radius = 800 + Math.random() * 1200;
      const segments = 6 + Math.floor(Math.random() * 3);
      
      const geometry = new THREE.ConeGeometry(radius, height, segments);
      const mountain = new THREE.Mesh(geometry, mountainMaterial);
      
      // Position mountains in a straight line behind the chain (negative Z)
      const xSpread = 8000; // How wide the mountain range spreads
      const xPosition = (i / 14 - 0.5) * xSpread; // -4000 to +4000
      const zPosition = -6000 - Math.random() * 2000; // Far behind chain
      
      mountain.position.set(
        xPosition,
        -600 + height / 2,
        zPosition
      );
      
      // Random rotation for variety
      mountain.rotation.y = Math.random() * Math.PI * 2;
      
      // Add some irregularity by scaling
      mountain.scale.set(
        1 + (Math.random() - 0.5) * 0.3,
        1,
        1 + (Math.random() - 0.5) * 0.3
      );
      
      mountain.castShadow = true;
      mountain.receiveShadow = true;
      
      this.mountains.push(mountain);
      this.scene.add(mountain);
    }
  }
  
  createMarsCity() {
    // Create Martian cities inside protective domes
    const martianBuildingMaterials = [
      new THREE.MeshPhysicalMaterial({
        color: 0xaa5544,
        emissive: 0x331122,
        emissiveIntensity: 0.2,
        metalness: 0.4,
        roughness: 0.6
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0x996644,
        emissive: 0x442211,
        emissiveIntensity: 0.15,
        metalness: 0.3,
        roughness: 0.7
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0x887755,
        emissive: 0x221100,
        emissiveIntensity: 0.1,
        metalness: 0.5,
        roughness: 0.5
      })
    ];
    
    // Create 2 domed city clusters
    const cityCenters = [
      { x: -3500, z: -4500, radius: 800 },
      { x: 2500, z: -5000, radius: 900 }
    ];
    
    cityCenters.forEach((center, cityIndex) => {
      // Create protective dome first
      const domeGeometry = new THREE.SphereGeometry(center.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88aacc,
        transparent: true,
        opacity: 0.3,
        emissive: 0x445577,
        emissiveIntensity: 0.2,
        metalness: 0.1,
        roughness: 0.1,
        clearcoat: 1.0,
        transmission: 0.7,
        thickness: 0.3
      });
      
      const dome = new THREE.Mesh(domeGeometry, domeMaterial);
      dome.position.set(center.x, -600, center.z);
      this.cityStructures.push(dome);
      this.scene.add(dome);
      
      // Create Martian-style buildings inside dome
      const buildingCount = 12 + Math.floor(Math.random() * 6);
      
      for (let i = 0; i < buildingCount; i++) {
        // Martian architecture: rounded corners, organic shapes
        const buildingType = Math.floor(Math.random() * 4);
        let geometry;
        
        switch(buildingType) {
          case 0: // Cylindrical towers (common on Mars)
            const radius = 30 + Math.random() * 40;
            const height = 200 + Math.random() * 400;
            geometry = new THREE.CylinderGeometry(radius, radius * 1.2, height, 8);
            break;
          case 1: // Rounded rectangular (safer from dust storms)
            const width = 60 + Math.random() * 60;
            const depth = 60 + Math.random() * 60;
            const boxHeight = 150 + Math.random() * 300;
            geometry = new THREE.BoxGeometry(width, boxHeight, depth);
            // Add rounded edges by scaling corners
            break;
          case 2: // Conical structures (wind-resistant)
            const coneRadius = 40 + Math.random() * 50;
            const coneHeight = 200 + Math.random() * 250;
            geometry = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
            break;
          default: // Dome buildings (pressure-resistant)
            const sphereRadius = 50 + Math.random() * 80;
            geometry = new THREE.SphereGeometry(sphereRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        }
        
        const material = martianBuildingMaterials[Math.floor(Math.random() * martianBuildingMaterials.length)];
        const building = new THREE.Mesh(geometry, material);
        
        // Position buildings in circular pattern inside dome
        const angle = (i / buildingCount) * Math.PI * 2;
        const distance = Math.random() * (center.radius * 0.6);
        const buildingHeight = geometry.parameters ? 
          (geometry.parameters.height || geometry.parameters.radius * 2) : 200;
        
        building.position.set(
          center.x + Math.cos(angle) * distance,
          -600 + (buildingType === 3 ? 0 : buildingHeight / 2),
          center.z + Math.sin(angle) * distance
        );
        
        building.rotation.y = Math.random() * Math.PI * 2;
        
        building.castShadow = true;
        building.receiveShadow = true;
        
        this.cityStructures.push(building);
        this.scene.add(building);
        
        // Add Martian-style lighting (reddish glow panels)
        if (Math.random() > 0.4) {
          const lightPanel = new THREE.BoxGeometry(
            (geometry.parameters.width || geometry.parameters.radius * 2) * 0.3,
            20,
            5
          );
          
          const lightMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6633,
            emissive: 0xff4422,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.7
          });
          
          const light = new THREE.Mesh(lightPanel, lightMaterial);
          light.position.copy(building.position);
          light.position.y += buildingHeight * 0.3;
          light.rotation.y = Math.random() * Math.PI * 2;
          
          this.cityLights.push(light);
          this.scene.add(light);
        }
      }
      
      // Add central Martian landmark (like a terraform station)
      const centralGeometry = new THREE.OctahedronGeometry(120, 1);
      const centralMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xcc6644,
        emissive: 0x664422,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 0.8
      });
      
      const centralBuilding = new THREE.Mesh(centralGeometry, centralMaterial);
      centralBuilding.position.set(center.x, -450, center.z);
      centralBuilding.castShadow = true;
      centralBuilding.receiveShadow = true;
      
      this.cityStructures.push(centralBuilding);
      this.scene.add(centralBuilding);
      
      // Add atmospheric processors (tall spires)
      for (let i = 0; i < 3; i++) {
        const spireGeometry = new THREE.ConeGeometry(15, 300, 6);
        const spireMaterial = new THREE.MeshBasicMaterial({
          color: 0x66aaff,
          emissive: 0x4488dd,
          emissiveIntensity: 1
        });
        
        const spire = new THREE.Mesh(spireGeometry, spireMaterial);
        const spireAngle = (i / 3) * Math.PI * 2;
        const spireDistance = center.radius * 0.8;
        
        spire.position.set(
          center.x + Math.cos(spireAngle) * spireDistance,
          -450,
          center.z + Math.sin(spireAngle) * spireDistance
        );
        
        this.cityLights.push(spire);
        this.scene.add(spire);
      }
    });
    
    // Add subtle city glow for each city center
    cityCenters.forEach(center => {
      const cityLight = new THREE.PointLight(0xffaa66, 1, 1500);
      cityLight.position.set(center.x, 0, center.z);
      this.scene.add(cityLight);
      this.cityLights.push(cityLight);
    });
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
    
    // Clean up Mars terrain
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
      this.terrain = null;
    }
    
    // Clean up rocks
    this.rocks.forEach(rock => {
      this.scene.remove(rock);
      rock.geometry.dispose();
      rock.material.dispose();
    });
    this.rocks = [];
    
    // Clean up dust particles
    if (this.dustParticles) {
      this.scene.remove(this.dustParticles);
      this.dustParticles.geometry.dispose();
      this.dustParticles.material.dispose();
      this.dustParticles = null;
    }
    
    // Remove fog
    this.scene.fog = null;
    
    // Clean up mountains
    this.mountains.forEach(mountain => {
      this.scene.remove(mountain);
      mountain.geometry.dispose();
      mountain.material.dispose();
    });
    this.mountains = [];
    
    // Clean up city structures
    this.cityStructures.forEach(structure => {
      this.scene.remove(structure);
      structure.geometry.dispose();
      structure.material.dispose();
    });
    this.cityStructures = [];
    
    // Clean up city lights
    this.cityLights.forEach(light => {
      this.scene.remove(light);
      if (light.geometry) light.geometry.dispose();
      if (light.material) light.material.dispose();
    });
    this.cityLights = [];
  }
}