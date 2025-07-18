import * as THREE from 'three';

export class SpaceTheme {
  constructor(scene) {
    this.scene = scene;
    this.shootingStars = [];
    this.lastShootingStarTime = 0;
    this.lastSegmentX = 0;
    this.segmentWidth = 2000;
    this.spaceships = [];
    this.lastSpaceshipTime = 0;
    this.nyanCats = [];
    this.lastNyanTime = 0;
    this.starFieldSegments = []; // Track individual starfield segments
    this.lastStarFieldSegmentX = 0;
    this.starFieldSegmentWidth = 6000; // Larger segments for background stars
    
    // Create comprehensive star background initially
    this.createInitialStarField();
  }

  createInitialStarField() {
    // Create initial background star segments covering a wide area
    for (let x = -15000; x <= 15000; x += this.starFieldSegmentWidth) {
      this.createBackgroundStarSegment(x);
    }
    this.lastStarFieldSegmentX = 15000;
  }

  createBackgroundStarSegment(centerX) {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1000 + Math.random() * 500; // 1000-1500 background stars per segment
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);
    
    const segmentWidth = this.starFieldSegmentWidth;
    
    for(let i = 0; i < starsCount; i++) {
      // Position stars within this segment
      positions[i * 3] = centerX + (Math.random() - 0.5) * segmentWidth; // X: within segment
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8000; // Y: full height
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8000; // Z: full depth
      
      // Star colors based on stellar types
      const rand = Math.random();
      if (rand < 0.6) {
        // White stars (60%)
        colors[i * 3] = 1.0;     // R
        colors[i * 3 + 1] = 1.0; // G
        colors[i * 3 + 2] = 1.0; // B
      } else if (rand < 0.8) {
        // Blue-white stars (20%)
        colors[i * 3] = 0.7;     // R
        colors[i * 3 + 1] = 0.9; // G
        colors[i * 3 + 2] = 1.0; // B
      } else if (rand < 0.9) {
        // Yellow stars (10%)
        colors[i * 3] = 1.0;     // R
        colors[i * 3 + 1] = 1.0; // G
        colors[i * 3 + 2] = 0.3; // B
      } else {
        // Red stars (10%)
        colors[i * 3] = 1.0;     // R
        colors[i * 3 + 1] = 0.3; // G
        colors[i * 3 + 2] = 0.3; // B
      }
      
      // Random star sizes with some larger ones
      sizes[i] = 1 + Math.random() * 4;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 2.5, // Slightly larger for better visibility
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    stars.userData = { 
      isBackgroundStarSegment: true, 
      segmentCenterX: centerX 
    };
    this.scene.add(stars);
    this.starFieldSegments.push(stars);
    
    return stars;
  }

  createPlanet(x, y, z, size, type = 'rocky') {
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    let material;
    
    switch (type) {
      case 'gas':
        material = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 1.0, 0.8),
          transparent: true,
          opacity: 0.9
        });
        break;
      case 'ice':
        material = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color().setHSL(0.55, 1.0, 0.9),
          transparent: true,
          opacity: 0.8
        });
        break;
      default: // rocky
        material = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color().setHSL(0.1 + Math.random() * 0.3, 1.0, 0.6)
        });
    }
    
    const planet = new THREE.Mesh(geometry, material);
    planet.position.set(x, y, z);
    planet.userData = {
      isPlanet: true,
      rotationSpeed: 0.001 + Math.random() * 0.002
    };
    
    // Add atmosphere for gas and ice planets
    if (type === 'gas' || type === 'ice') {
      const atmosphereGeometry = new THREE.SphereGeometry(size * 1.1, 32, 32);
      const atmosphereMaterial = new THREE.MeshLambertMaterial({
        color: type === 'gas' ? 0x2288ff : 0x88ffff,
        transparent: true,
        opacity: 0.3
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      planet.add(atmosphere);
    }
    
    return planet;
  }

  createSun(x, y, z) {
    const geometry = new THREE.SphereGeometry(200, 32, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffcc00,
      transparent: true,
      opacity: 0.9
    });
    const sun = new THREE.Mesh(geometry, material);
    sun.position.set(x, y, z);
    sun.userData = { isSun: true };
    
    // Add brighter glow effect
    const glowGeometry = new THREE.SphereGeometry(300, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff44,
      transparent: true,
      opacity: 0.15
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    sun.add(glow);
    
    return sun;
  }

  createEarth(x, y, z) {
    const geometry = new THREE.SphereGeometry(80, 32, 32);
    const material = new THREE.MeshLambertMaterial({ color: 0x2299ff });
    const earth = new THREE.Mesh(geometry, material);
    earth.position.set(x, y, z);
    earth.userData = { isPlanet: true, rotationSpeed: 0.002 };
    
    // Add moon
    const moonGeometry = new THREE.SphereGeometry(20, 16, 16);
    const moonMaterial = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(150, 0, 0);
    moon.userData = { isMoon: true };
    earth.add(moon);
    
    return earth;
  }

  createAsteroid(x, y, z, size = 10) {
    const geometry = new THREE.DodecahedronGeometry(size + Math.random() * size);
    const material = new THREE.MeshLambertMaterial({ color: 0x888844 });
    const asteroid = new THREE.Mesh(geometry, material);
    asteroid.position.set(x, y, z);
    asteroid.userData = {
      isAsteroid: true,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      }
    };
    return asteroid;
  }

  createGalaxy(x, y, z, type = 'spiral') {
    const particleCount = 1000 + Math.random() * 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      if (type === 'spiral') {
        const angle = Math.random() * Math.PI * 4;
        const radius = Math.random() * 500;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = (Math.random() - 0.5) * 50;
        positions[i3 + 2] = Math.sin(angle) * radius;
      } else if (type === 'elliptical') {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = Math.random() * 400;
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.cos(phi);
        positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      } else { // irregular
        positions[i3] = (Math.random() - 0.5) * 600;
        positions[i3 + 1] = (Math.random() - 0.5) * 200;
        positions[i3 + 2] = (Math.random() - 0.5) * 600;
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xaaffff,
      size: 2,
      transparent: true,
      opacity: 0.8
    });
    
    const galaxy = new THREE.Points(geometry, material);
    galaxy.position.set(x, y, z);
    galaxy.userData = { isGalaxy: true };
    
    return galaxy;
  }

  createShootingStar() {
    const group = new THREE.Group();
    
    // Create the comet head
    const headGeometry = new THREE.SphereGeometry(3, 8, 8);
    const headMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    group.add(head);
    
    // Create the comet tail using line geometry for better performance
    const trailPoints = [];
    const trailLength = 40;
    for (let i = 0; i < trailLength; i++) {
      trailPoints.push(new THREE.Vector3(-i * 2, 0, 0));
    }
    
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.8
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    group.add(trail);
    
    // Random position in a large sphere around the scene
    const angle = Math.random() * Math.PI * 2;
    const height = Math.random() * Math.PI - Math.PI / 2;
    const distance = 4000 + Math.random() * 2000;
    
    group.position.set(
      Math.cos(height) * Math.cos(angle) * distance,
      Math.sin(height) * distance,
      Math.cos(height) * Math.sin(angle) * distance
    );
    
    // Random velocity pointing roughly toward center but with variation
    const targetX = (Math.random() - 0.5) * 1000;
    const targetY = (Math.random() - 0.5) * 400;
    const targetZ = (Math.random() - 0.5) * 1000;
    
    const direction = new THREE.Vector3(targetX, targetY, targetZ)
      .sub(group.position)
      .normalize()
      .multiplyScalar(25 + Math.random() * 35);
    
    // Orient the group to point in direction of movement
    group.lookAt(group.position.clone().add(direction));
    
    group.userData = {
      isShootingStar: true,
      velocity: direction,
      life: 1.0
    };
    
    return group;
  }

  createRocketship(x, y, z) {
    const rocket = new THREE.Group();
    const scale = 2.0; // Make rockets 2x larger
    
    // Main body (bright metallic silver)
    const bodyGeometry = new THREE.CylinderGeometry(10 * scale, 14 * scale, 50 * scale, 12);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0xdddddd,
      metalness: 0.9,
      roughness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    rocket.add(body);
    
    // Nose cone (vibrant red)
    const noseGeometry = new THREE.ConeGeometry(10 * scale, 20 * scale, 12);
    const noseMaterial = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.y = 35 * scale;
    rocket.add(nose);
    
    // Wings (4 wings for better stability look) - bright colors
    for (let i = 0; i < 4; i++) {
      const wingGeometry = new THREE.BoxGeometry(6 * scale, 25 * scale, 15 * scale);
      const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xff6600 });
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      const angle = (i / 4) * Math.PI * 2;
      wing.position.x = Math.cos(angle) * 16 * scale;
      wing.position.z = Math.sin(angle) * 16 * scale;
      wing.position.y = -18 * scale;
      rocket.add(wing);
    }
    
    // Exhaust nozzle (darker for contrast)
    const exhaustGeometry = new THREE.ConeGeometry(10 * scale, 15 * scale, 8);
    const exhaustMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.y = -35 * scale;
    rocket.add(exhaust);
    
    // Bright blue thruster glow (much larger and more vibrant)
    const thrusterGeometry = new THREE.SphereGeometry(18 * scale, 16, 16);
    const thrusterMaterial = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.8
    });
    const thrusterGlow = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    thrusterGlow.position.y = -48 * scale;
    thrusterGlow.userData = { isThrusterGlow: true };
    rocket.add(thrusterGlow);
    
    // Larger exhaust trail (bright cyan)
    const trailGeometry = new THREE.ConeGeometry(12 * scale, 45 * scale, 8);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.6
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.position.y = -70 * scale;
    trail.userData = { isExhaustTrail: true };
    rocket.add(trail);
    
    rocket.position.set(x, y, z);
    
    // More varied velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 30
    );
    
    rocket.userData = {
      isRocketship: true,
      velocity: velocity,
      life: 1.0
    };
    
    return rocket;
  }

  createNyanCat(x, y, z) {
    const nyanCat = new THREE.Group();
    const scale = 2.5; // Make everything 2.5x larger
    
    // Create pixelated cat body (brighter gray)
    const bodyGeometry = new THREE.BoxGeometry(16 * scale, 12 * scale, 8 * scale);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    nyanCat.add(body);
    
    // Cat head (brighter gray)
    const headGeometry = new THREE.BoxGeometry(12 * scale, 10 * scale, 8 * scale);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(14 * scale, 1 * scale, 0);
    nyanCat.add(head);
    
    // Cat ears (bright pink)
    for (let i = 0; i < 2; i++) {
      const earGeometry = new THREE.ConeGeometry(2 * scale, 4 * scale, 4);
      const earMaterial = new THREE.MeshBasicMaterial({ color: 0xff6699 });
      const ear = new THREE.Mesh(earGeometry, earMaterial);
      ear.position.set((14 + (i - 0.5) * 6) * scale, 7 * scale, 0);
      nyanCat.add(ear);
    }
    
    // Cat tail (dark gray with stripes)
    const tailGeometry = new THREE.BoxGeometry(3 * scale, 3 * scale, 20 * scale);
    const tailMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(-12 * scale, 0, 0);
    tail.userData = { isTail: true };
    nyanCat.add(tail);
    
    // Pop-Tart body (brighter tan)
    const tartGeometry = new THREE.BoxGeometry(18 * scale, 12 * scale, 6 * scale);
    const tartMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc99 });
    const tart = new THREE.Mesh(tartGeometry, tartMaterial);
    tart.position.set(0, 0, -1 * scale);
    nyanCat.add(tart);
    
    // Pop-Tart frosting (vibrant pink)
    const frostingGeometry = new THREE.BoxGeometry(16 * scale, 10 * scale, 6.1 * scale);
    const frostingMaterial = new THREE.MeshBasicMaterial({ color: 0xff44bb });
    const frosting = new THREE.Mesh(frostingGeometry, frostingMaterial);
    frosting.position.set(0, 0, -0.9 * scale);
    nyanCat.add(frosting);
    
    // Cat eyes (larger and more visible)
    for (let i = 0; i < 2; i++) {
      const eyeGeometry = new THREE.BoxGeometry(3 * scale, 3 * scale, 1 * scale);
      const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(16 * scale, (2 + (i - 0.5) * 4) * scale, 4.1 * scale);
      nyanCat.add(eye);
    }
    
    // Create rainbow trail (larger and more vibrant)
    const trailGroup = new THREE.Group();
    const rainbowColors = [0xff2222, 0xff8822, 0xffff22, 0x22ff22, 0x2288ff, 0x8822ff];
    
    for (let i = 0; i < rainbowColors.length; i++) {
      const stripeGeometry = new THREE.BoxGeometry(120 * scale, 4 * scale, 8 * scale);
      const stripeMaterial = new THREE.MeshBasicMaterial({ 
        color: rainbowColors[i],
        transparent: false
      });
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.position.set(-60 * scale, (i - 2.5) * 4 * scale, 0);
      trailGroup.add(stripe);
    }
    
    trailGroup.userData = { isRainbowTrail: true };
    nyanCat.add(trailGroup);
    
    nyanCat.position.set(x, y, z);
    
    // Random velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 25
    );
    
    nyanCat.userData = {
      isNyanCat: true,
      velocity: velocity,
      bobOffset: Math.random() * Math.PI * 2,
      life: 1.0
    };
    
    return nyanCat;
  }

  createStarCluster(x, y, z) {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 50 + Math.random() * 100; // 50-150 stars per cluster
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);
    
    const clusterRadius = 200 + Math.random() * 300; // Cluster spread
    
    for(let i = 0; i < starsCount; i++) {
      // Position stars in a spherical cluster
      const angle = Math.random() * Math.PI * 2;
      const height = Math.random() * Math.PI - Math.PI / 2;
      const distance = Math.random() * clusterRadius;
      
      positions[i * 3] = Math.cos(height) * Math.cos(angle) * distance;
      positions[i * 3 + 1] = Math.sin(height) * distance;
      positions[i * 3 + 2] = Math.cos(height) * Math.sin(angle) * distance;
      
      // Star colors based on stellar types
      const rand = Math.random();
      if (rand < 0.6) {
        // White stars (60%)
        colors[i * 3] = 1.0;     // R
        colors[i * 3 + 1] = 1.0; // G
        colors[i * 3 + 2] = 1.0; // B
      } else if (rand < 0.8) {
        // Blue-white stars (20%)
        colors[i * 3] = 0.7;     // R
        colors[i * 3 + 1] = 0.9; // G
        colors[i * 3 + 2] = 1.0; // B
      } else if (rand < 0.9) {
        // Yellow stars (10%)
        colors[i * 3] = 1.0;     // R
        colors[i * 3 + 1] = 1.0; // G
        colors[i * 3 + 2] = 0.3; // B
      } else {
        // Red stars (10%)
        colors[i * 3] = 1.0;     // R
        colors[i * 3 + 1] = 0.3; // G
        colors[i * 3 + 2] = 0.3; // B
      }
      
      // Random star sizes
      sizes[i] = 1 + Math.random() * 4;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: true, // Make distant stars smaller
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    stars.position.set(x, y, z);
    stars.userData = { 
      isStarCluster: true,
      twinkle: Math.random() * Math.PI * 2 // Random phase for twinkling
    };
    
    return stars;
  }

  generateSegment(minX, maxX, minTimestamp, currentTimestamp, spacing) {
    const segments = Math.ceil((maxX - this.lastSegmentX) / this.segmentWidth);
    
    // Generate background star segments for the expanded area
    const starSegmentsNeeded = Math.ceil((maxX - this.lastStarFieldSegmentX) / this.starFieldSegmentWidth);
    for (let i = 0; i < starSegmentsNeeded; i++) {
      const starX = this.lastStarFieldSegmentX + (i + 1) * this.starFieldSegmentWidth;
      this.createBackgroundStarSegment(starX);
    }
    this.lastStarFieldSegmentX = this.lastStarFieldSegmentX + starSegmentsNeeded * this.starFieldSegmentWidth;
    
    for (let seg = 0; seg < segments; seg++) {
      const segmentX = this.lastSegmentX + (seg + 1) * this.segmentWidth;
      
      // Create planets positioned closer to blockchain
      for (let i = 0; i < 2 + Math.random() * 3; i++) {
        const planetTypes = ['rocky', 'gas', 'ice'];
        const type = planetTypes[Math.floor(Math.random() * planetTypes.length)];
        const size = 20 + Math.random() * 40;
        
        // Position planets closer to the blockchain flow
        const planet = this.createPlanet(
          segmentX + (Math.random() - 0.5) * this.segmentWidth,
          (Math.random() > 0.5 ? 1 : -1) * (800 + Math.random() * 600), // Y: ±800-1400
          (Math.random() > 0.5 ? 1 : -1) * (1200 + Math.random() * 800), // Z: ±1200-2000
          size,
          type
        );
        this.scene.add(planet);
      }
      
      // Add special objects occasionally
      if (Math.random() < 0.2) {
        if (Math.random() < 0.5) {
          // Add sun (smaller and closer)
          const sun = this.createSun(
            segmentX + (Math.random() - 0.5) * this.segmentWidth,
            (Math.random() > 0.5 ? 1 : -1) * (1200 + Math.random() * 800),
            (Math.random() > 0.5 ? 1 : -1) * (2000 + Math.random() * 1000)
          );
          this.scene.add(sun);
        } else {
          // Add Earth (closer)
          const earth = this.createEarth(
            segmentX + (Math.random() - 0.5) * this.segmentWidth,
            (Math.random() > 0.5 ? 1 : -1) * (1000 + Math.random() * 600),
            (Math.random() > 0.5 ? 1 : -1) * (1500 + Math.random() * 800)
          );
          this.scene.add(earth);
        }
      }
      
      // Add asteroid field (closer and fewer)
      if (Math.random() < 0.3) {
        for (let j = 0; j < 3 + Math.random() * 5; j++) {
          const asteroid = this.createAsteroid(
            segmentX + (Math.random() - 0.5) * this.segmentWidth * 0.5,
            (Math.random() > 0.5 ? 1 : -1) * (600 + Math.random() * 800),
            (Math.random() > 0.5 ? 1 : -1) * (800 + Math.random() * 1000),
            3 + Math.random() * 8
          );
          this.scene.add(asteroid);
        }
      }
      
      // Add distant galaxies (smaller and closer)
      if (Math.random() < 0.1) {
        const galaxyTypes = ['spiral', 'elliptical', 'irregular'];
        const type = galaxyTypes[Math.floor(Math.random() * galaxyTypes.length)];
        const galaxy = this.createGalaxy(
          segmentX + (Math.random() - 0.5) * this.segmentWidth * 1.5,
          (Math.random() > 0.5 ? 1 : -1) * (2000 + Math.random() * 1000),
          (Math.random() > 0.5 ? 1 : -1) * (3000 + Math.random() * 1500),
          type
        );
        this.scene.add(galaxy);
      }
      
      // Add rocketships occasionally (closer)
      if (Math.random() < 0.05) {
        const rocket = this.createRocketship(
          segmentX + (Math.random() - 0.5) * this.segmentWidth,
          (Math.random() - 0.5) * 600,
          (Math.random() > 0.5 ? 1 : -1) * (800 + Math.random() * 600)
        );
        this.scene.add(rocket);
      }
      
      // Add asteroid clusters
      if (Math.random() < 0.2) {
        const clusterCount = 3 + Math.random() * 5;
        for (let j = 0; j < clusterCount; j++) {
          const asteroid = this.createAsteroid(
            segmentX + (Math.random() - 0.5) * this.segmentWidth * 0.3,
            (Math.random() > 0.5 ? 1 : -1) * (400 + Math.random() * 400),
            (Math.random() > 0.5 ? 1 : -1) * (600 + Math.random() * 600),
            2 + Math.random() * 6
          );
          this.scene.add(asteroid);
        }
      }
      
      // Add dynamic star clusters for this segment
      const starClusterCount = 3 + Math.random() * 5; // 3-8 star clusters per segment
      for (let i = 0; i < starClusterCount; i++) {
        const stars = this.createStarCluster(
          segmentX + (Math.random() - 0.5) * this.segmentWidth,
          (Math.random() - 0.5) * 3000, // Y: ±3000
          (Math.random() - 0.5) * 4000  // Z: ±4000
        );
        this.scene.add(stars);
      }
    }
    
    this.lastSegmentX = this.lastSegmentX + segments * this.segmentWidth;
  }

  updateAnimations(cameraX = 0) {
    const now = Date.now();
    
    // Create shooting stars/comets more frequently for better effect
    if (now - this.lastShootingStarTime > 1500 + Math.random() * 2000) {
      const shootingStar = this.createShootingStar();
      this.scene.add(shootingStar);
      this.shootingStars.push(shootingStar);
      this.lastShootingStarTime = now;
      
      // Limit number of shooting stars
      if (this.shootingStars.length > 15) {
        const oldStar = this.shootingStars.shift();
        this.scene.remove(oldStar);
        if (oldStar.geometry) oldStar.geometry.dispose();
        if (oldStar.material) oldStar.material.dispose();
      }
    }
    
    // Create spaceships occasionally
    if (now - this.lastSpaceshipTime > 8000 + Math.random() * 12000) {
      const spaceship = this.createRocketship(
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 800,
        (Math.random() > 0.5 ? 1 : -1) * (1000 + Math.random() * 1000)
      );
      this.scene.add(spaceship);
      this.spaceships.push(spaceship);
      this.lastSpaceshipTime = now;
      
      // Limit number of spaceships
      if (this.spaceships.length > 5) {
        const oldShip = this.spaceships.shift();
        this.scene.remove(oldShip);
        oldShip.traverse((child) => {
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
    
    // Create Nyan cats occasionally
    if (now - this.lastNyanTime > 10000 + Math.random() * 15000) {
      const nyanCat = this.createNyanCat(
        (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 1000,
        (Math.random() > 0.5 ? 1 : -1) * (1200 + Math.random() * 1500)
      );
      this.scene.add(nyanCat);
      this.nyanCats.push(nyanCat);
      this.lastNyanTime = now;
      
      // Limit number of nyan cats
      if (this.nyanCats.length > 3) {
        const oldCat = this.nyanCats.shift();
        this.scene.remove(oldCat);
        oldCat.traverse((child) => {
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
    
    // Update all space objects
    this.scene.children.forEach(child => {
      // Animate planets
      if (child.userData.isPlanet && child.userData.rotationSpeed) {
        child.rotation.y += child.userData.rotationSpeed;
      }
      
      // Animate moon orbiting Earth
      if (child.userData.isMoon) {
        const time = Date.now() * 0.001;
        child.position.x = Math.cos(time) * 150;
        child.position.z = Math.sin(time) * 150;
      }
      
      // Animate sun glow
      if (child.userData.isSun) {
        child.rotation.y += 0.002;
        const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 0.9;
        child.material.opacity = pulse * 0.8;
      }
      
      // Animate asteroids
      if (child.userData.isAsteroid && child.userData.rotationSpeed) {
        child.rotation.x += child.userData.rotationSpeed.x;
        child.rotation.y += child.userData.rotationSpeed.y;
        child.rotation.z += child.userData.rotationSpeed.z;
      }
      
      // Animate shooting stars/comets
      if (child.userData.isShootingStar) {
        child.position.add(child.userData.velocity);
        
        // Fade out over time
        child.userData.life -= 0.008;
        
        child.children.forEach(part => {
          if (part.material) {
            part.material.opacity = child.userData.life * 0.8;
          }
        });
        
        if (child.position.length() > 10000 || child.userData.life <= 0) {
          this.scene.remove(child);
          child.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
          });
          
          const index = this.shootingStars.findIndex(star => star === child);
          if (index !== -1) {
            this.shootingStars.splice(index, 1);
          }
        }
      }
      
      // Animate rocketships with enhanced effects
      if (child.userData.isRocketship && child.userData.velocity) {
        child.position.add(child.userData.velocity);
        child.lookAt(child.position.clone().add(child.userData.velocity));
        
        // Fade out over time
        child.userData.life -= 0.002;
        
        child.children.forEach(part => {
          if (part.userData.isThrusterGlow) {
            const pulse = Math.sin(Date.now() * 0.015) * 0.3 + 0.7;
            part.material.opacity = pulse * 0.6 * child.userData.life;
            part.scale.setScalar(1 + pulse * 0.4);
          }
          if (part.userData.isExhaustTrail) {
            const pulse = Math.sin(Date.now() * 0.012) * 0.2 + 0.8;
            part.material.opacity = pulse * 0.4 * child.userData.life;
            part.scale.y = 1 + pulse * 0.3;
          }
        });
        
        if (child.position.length() > 8000 || child.userData.life <= 0) {
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
          
          const index = this.spaceships.findIndex(ship => ship === child);
          if (index !== -1) {
            this.spaceships.splice(index, 1);
          }
        }
      }
      
      // Animate star clusters (twinkling effect)
      if (child.userData.isStarCluster) {
        const time = Date.now() * 0.002;
        const twinklePhase = child.userData.twinkle;
        const twinkle = Math.sin(time + twinklePhase) * 0.3 + 0.7;
        child.material.opacity = twinkle * 0.8;
      }
      
      // Animate Nyan cats
      if (child.userData.isNyanCat && child.userData.velocity) {
        child.position.add(child.userData.velocity);
        child.lookAt(child.position.clone().add(child.userData.velocity));
        
        // Add gentle bobbing motion
        const time = Date.now() * 0.003;
        const bobAmount = Math.sin(time + child.userData.bobOffset) * 15;
        child.position.y += bobAmount * 0.01;
        
        // Animate tail wagging
        child.children.forEach(part => {
          if (part.userData.isTail) {
            part.rotation.z = Math.sin(time * 4) * 0.3;
          }
          // Animate rainbow trail (slight wave motion)
          if (part.userData.isRainbowTrail) {
            part.children.forEach((stripe, index) => {
              stripe.position.y = (index - 2.5) * 2.5 + Math.sin(time * 2 + index * 0.5) * 2;
            });
          }
        });
        
        // Fade out over time
        child.userData.life -= 0.001;
        child.children.forEach(part => {
          if (part.material) {
            part.material.opacity = child.userData.life;
          }
          part.traverse((subChild) => {
            if (subChild.material) {
              subChild.material.opacity = child.userData.life;
            }
          });
        });
        
        // Remove when too far or faded
        if (child.position.length() > 8000 || child.userData.life <= 0) {
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
          
          const index = this.nyanCats.findIndex(cat => cat === child);
          if (index !== -1) {
            this.nyanCats.splice(index, 1);
          }
        }
      }
    });
    
    // Clean up theme objects that are far behind the camera
    if (cameraX > 0) {
      const toRemove = [];
      this.scene.children.forEach(child => {
        if (child.userData.isPlanet || child.userData.isSun || child.userData.isAsteroid || child.userData.isGalaxy || child.userData.isStarCluster) {
          const distanceBehindCamera = cameraX - child.position.x;
          if (distanceBehindCamera > 4000) { // Remove objects far behind camera
            toRemove.push(child);
          }
        }
        // Clean up background star segments that are far behind
        if (child.userData.isBackgroundStarSegment) {
          const distanceBehindCamera = cameraX - child.userData.segmentCenterX;
          if (distanceBehindCamera > 20000) { // Keep background stars much longer
            toRemove.push(child);
            // Remove from tracking array
            const index = this.starFieldSegments.findIndex(segment => segment === child);
            if (index !== -1) {
              this.starFieldSegments.splice(index, 1);
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
    // Clean up all space theme objects - collect first, then remove to avoid iteration issues
    const toRemove = [];
    this.scene.children.forEach(child => {
      if (child.userData.isPlanet || child.userData.isSun || child.userData.isAsteroid || 
          child.userData.isGalaxy || child.userData.isShootingStar || child.userData.isRocketship ||
          child.userData.isNyanCat || child.userData.isStarField || child.userData.isStarCluster ||
          child.userData.isBackgroundStarSegment) {
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
    this.shootingStars = [];
    this.spaceships = [];
    this.nyanCats = [];
    this.starFieldSegments = [];
  }
}