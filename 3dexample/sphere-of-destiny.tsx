import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

// Master Glyph Database
const MASTER_GLYPHS = {
  1: { symbol: '𒀱', name: 'KA', color: '#ff6b6b', frequency: 432 },
  2: { symbol: '𓂀', name: 'ĀKH', color: '#4ecdc4', frequency: 528 },
  3: { symbol: 'ᚾ', name: 'NYR', color: '#45b7d1', frequency: 396 },
  4: { symbol: '𐤀', name: 'ALEPH', color: '#96ceb4', frequency: 741 },
  5: { symbol: '𖣔', name: 'VYON', color: '#f9ca24', frequency: 639 },
  6: { symbol: '𐬛', name: 'DAR', color: '#f0932b', frequency: 417 },
  11: { symbol: '⍝', name: 'NULL', color: '#000000', frequency: 0 }, // The Void
  33: { symbol: '◉', name: 'UNIFIED', color: '#ffffff', frequency: 963 } // Supreme
};

interface ConsciousnessFeatures {
  breathIntensity: number;
  coherence: number;
  recursionIndex: number;
  owensPotential: number;
  phase: 'inhale' | 'exhale' | 'hold' | 'rest';
}

interface Props {
  className?: string;
  breathData?: ConsciousnessFeatures;
  onGlyphActivation?: (glyphId: number) => void;
}

export default function IXAlephConsciousnessSphere({ 
  className = '', 
  breathData,
  onGlyphActivation 
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const sphereRef = useRef<THREE.Group | null>(null);
  const prismRef = useRef<THREE.Mesh | null>(null);
  
  const [activeGlyph, setActiveGlyph] = useState<number | null>(null);
  const [protection, setProtection] = useState(false);
  
  // Mouse interaction state
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const rotationVelocityRef = useRef({ x: 0, y: 0 });
  
  // Quantum node state
  const nodesRef = useRef<{
    mesh: THREE.InstancedMesh;
    positions: THREE.Vector3[];
    intensities: Float32Array;
    colors: Float32Array;
  } | null>(null);

  // Store refs for animation
  const animationDataRef = useRef({
    breathData: breathData || {
      breathIntensity: 0.3,
      coherence: 0.5,
      recursionIndex: 0,
      owensPotential: 0.5,
      phase: 'rest' as const
    },
    activeGlyph: activeGlyph
  });
  
  // Update animation data without re-initializing
  useEffect(() => {
    animationDataRef.current.breathData = breathData || {
      breathIntensity: 0.3,
      coherence: 0.5,
      recursionIndex: 0,
      owensPotential: 0.5,
      phase: 'rest' as const
    };
  }, [breathData]);
  
  useEffect(() => {
    animationDataRef.current.activeGlyph = activeGlyph;
  }, [activeGlyph]);

  // Handle mouse events
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current) return;
    
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (mouseRef.current.isDown) {
      const deltaX = x - mouseRef.current.x;
      const deltaY = y - mouseRef.current.y;
      
      rotationVelocityRef.current.x = deltaY * 0.01;
      rotationVelocityRef.current.y = deltaX * 0.01;
    }
    
    mouseRef.current.x = x;
    mouseRef.current.y = y;
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    mouseRef.current.isDown = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    mouseRef.current.isDown = false;
  }, []);

  // Initialize scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    scene.fog = new THREE.FogExp2(0x000011, 0.08);
    sceneRef.current = scene;
    
    // Get container dimensions
    const containerWidth = mountRef.current.clientWidth;
    const containerHeight = mountRef.current.clientHeight;
    
    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }
    rendererRef.current = renderer;
    
    // Create sphere group
    const sphereGroup = new THREE.Group();
    sphereRef.current = sphereGroup;
    scene.add(sphereGroup);
    
    // Create central prism (octahedron) with emissive material
    const prismGeometry = new THREE.OctahedronGeometry(0.3, 0);
    const prismMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      wireframe: true
    });
    const prism = new THREE.Mesh(prismGeometry, prismMaterial);
    prismRef.current = prism;
    sphereGroup.add(prism);
    
    // Add glow to prism
    const glowGeometry = new THREE.OctahedronGeometry(0.4, 0);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    prism.add(glowMesh);
    
    // Create quantum nodes (Fibonacci sphere)
    const nodeCount = 1000;
    const nodeGeometry = new THREE.SphereGeometry(0.02, 6, 6);
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      vertexColors: true
    });
    
    const instancedMesh = new THREE.InstancedMesh(
      nodeGeometry,
      nodeMaterial,
      nodeCount
    );
    
    const positions: THREE.Vector3[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
    
    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      const position = new THREE.Vector3(x * 2, y * 2, z * 2);
      positions.push(position);
      
      const matrix = new THREE.Matrix4();
      matrix.setPosition(position);
      instancedMesh.setMatrixAt(i, matrix);
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    sphereGroup.add(instancedMesh);
    
    nodesRef.current = {
      mesh: instancedMesh,
      positions,
      intensities: new Float32Array(nodeCount),
      colors: new Float32Array(nodeCount * 3)
    };
    
    // Enhanced lighting for prism effect
    const ambientLight = new THREE.AmbientLight(0x0000ff, 0.1);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 2, 10);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);
    
    // Add colored lights for electromagnetic spectrum effect
    const redLight = new THREE.PointLight(0xff0000, 0.5, 5);
    redLight.position.set(2, 0, 0);
    scene.add(redLight);
    
    const blueLight = new THREE.PointLight(0x0000ff, 0.5, 5);
    blueLight.position.set(-2, 0, 0);
    scene.add(blueLight);
    
    const greenLight = new THREE.PointLight(0x00ff00, 0.5, 5);
    greenLight.position.set(0, 2, 0);
    scene.add(greenLight);
    
    // Protection field geometry
    const protectionGeometry = new THREE.IcosahedronGeometry(3, 1);
    const protectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const protectionField = new THREE.Mesh(protectionGeometry, protectionMaterial);
    scene.add(protectionField);
    
    // Store refs for animation
    const animationRefs = {
      protectionField,
      protectionMaterial
    };
    
    // Animation
    const animate = (time: number) => {
      frameRef.current = requestAnimationFrame(animate);
      
      const t = time * 0.001;
      
      // Get current breath state
      const features = animationDataRef.current.breathData;
      
      // Update protection field
      if (features.recursionIndex > 0.3) {
        setProtection(true);
        animationRefs.protectionMaterial.opacity = features.recursionIndex * 0.5;
        animationRefs.protectionField.rotation.x = t * 0.5;
        animationRefs.protectionField.rotation.y = t * 0.3;
      } else {
        setProtection(false);
        animationRefs.protectionMaterial.opacity *= 0.95; // Fade out
      }
      
      // Apply rotation velocity with damping
      rotationVelocityRef.current.x *= 0.95;
      rotationVelocityRef.current.y *= 0.95;
      
      // Rotate sphere based on breath and mouse interaction
      if (sphereRef.current) {
        sphereRef.current.rotation.x += rotationVelocityRef.current.x;
        sphereRef.current.rotation.y += rotationVelocityRef.current.y + t * 0.1;
        
        // Breathing effect
        const breathScale = 1 + features.breathIntensity * 0.2;
        sphereRef.current.scale.setScalar(breathScale);
      }
      
      // Update prism
      if (prismRef.current) {
        prismRef.current.rotation.x = t * 2;
        prismRef.current.rotation.y = t * 3;
        
        // Prism color based on active glyph
        if (animationDataRef.current.activeGlyph && MASTER_GLYPHS[animationDataRef.current.activeGlyph as keyof typeof MASTER_GLYPHS]) {
          const glyph = MASTER_GLYPHS[animationDataRef.current.activeGlyph as keyof typeof MASTER_GLYPHS];
          (prismRef.current.material as THREE.MeshBasicMaterial).color.set(glyph.color);
        }
      }
      
      // Update quantum nodes with electromagnetic spectrum colors
      if (nodesRef.current) {
        const { mesh, positions, intensities } = nodesRef.current;
        
        // Calculate which nodes should be active based on consciousness state
        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          
          // Base intensity from breath
          let intensity = features.breathIntensity * 0.5;
          
          // Modulate by position and phase
          const phase = t + pos.x * 2 + pos.y * 3 + pos.z;
          intensity *= (1 + Math.sin(phase) * 0.5);
          
          // Apply coherence
          intensity *= features.coherence;
          
          // Special patterns for specific glyphs
          if (animationDataRef.current.activeGlyph === 11) { // NULL glyph
            // Create void pattern
            const distance = pos.length();
            intensity *= Math.max(0, 1 - distance / 2);
          } else if (animationDataRef.current.activeGlyph === 33) { // UNIFIED glyph
            // All nodes pulse together
            intensity = Math.sin(t * 3) * 0.5 + 0.5;
          }
          
          intensities[i] = intensity;
          
          // Update node appearance
          const matrix = new THREE.Matrix4();
          const scale = 0.5 + intensity * 1.5;
          matrix.makeScale(scale, scale, scale);
          matrix.setPosition(pos);
          mesh.setMatrixAt(i, matrix);
          
          // Electromagnetic spectrum colors based on position and intensity
          const wavelength = 380 + (i / positions.length) * 320; // 380-700nm visible spectrum
          const color = new THREE.Color();
          
          // Convert wavelength to RGB (simplified)
          if (wavelength >= 380 && wavelength < 440) {
            // Violet
            const attenuation = 0.3 + 0.7 * (wavelength - 380) / (440 - 380);
            color.setRGB((440 - wavelength) / (440 - 380) * attenuation, 0, attenuation);
          } else if (wavelength >= 440 && wavelength < 490) {
            // Blue
            color.setRGB(0, (wavelength - 440) / (490 - 440), 1);
          } else if (wavelength >= 490 && wavelength < 510) {
            // Cyan
            color.setRGB(0, 1, (510 - wavelength) / (510 - 490));
          } else if (wavelength >= 510 && wavelength < 580) {
            // Green
            color.setRGB((wavelength - 510) / (580 - 510), 1, 0);
          } else if (wavelength >= 580 && wavelength < 645) {
            // Yellow to Orange
            color.setRGB(1, (645 - wavelength) / (645 - 580), 0);
          } else if (wavelength >= 645 && wavelength <= 700) {
            // Red
            color.setRGB(1, 0, 0);
          }
          
          // Modulate color by intensity
          color.multiplyScalar(intensity * 2);
          mesh.setColorAt(i, color);
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      
      // Check for glyph activation
      if (features.coherence > 0.8 && features.owensPotential > 0.7) {
        const glyphId = Math.floor(features.breathIntensity * 10) % 8 + 1;
        if (glyphId !== animationDataRef.current.activeGlyph) {
          setActiveGlyph(glyphId);
          onGlyphActivation?.(glyphId);
        }
      }
      
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };

    animate(0);
    
    // Handle resize with ResizeObserver for container-aware sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (camera && renderer) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    
    resizeObserver.observe(mountRef.current);
    
    // Add mouse event listeners
    const element = renderer.domElement;
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', handleMouseUp);
    
    return () => {
      resizeObserver.disconnect();
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseleave', handleMouseUp);
      
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      
      // Properly dispose of Three.js resources
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      
      if (renderer.domElement && mountRef.current && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, []); // Remove all dependencies to prevent re-initialization
  
  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      
      {/* Glyph Display */}
      {activeGlyph && MASTER_GLYPHS[activeGlyph as keyof typeof MASTER_GLYPHS] && (
        <div className="absolute top-4 right-4 text-white text-right">
          <div className="text-6xl mb-2 animate-pulse">
            {MASTER_GLYPHS[activeGlyph as keyof typeof MASTER_GLYPHS].symbol}
          </div>
          <div className="text-xl font-bold">
            {MASTER_GLYPHS[activeGlyph as keyof typeof MASTER_GLYPHS].name}
          </div>
          <div className="text-sm opacity-75">
            {MASTER_GLYPHS[activeGlyph as keyof typeof MASTER_GLYPHS].frequency} Hz
          </div>
        </div>
      )}
      
      {/* Protection Active */}
      {protection && (
        <div className="absolute top-4 left-4 bg-red-900/50 backdrop-blur px-4 py-2 rounded">
          <div className="text-red-300 font-mono text-sm">
            ⚠️ ALEPH ONE NULL PROTECTION ACTIVE
          </div>
        </div>
      )}
      
      {/* Consciousness Meter */}
      {breathData && (
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur p-3 rounded text-white text-xs font-mono">
          <div>Coherence: {(breathData.coherence * 100).toFixed(0)}%</div>
          <div>Owens: {breathData.owensPotential.toFixed(3)}</div>
          <div>Phase: {breathData.phase}</div>
          {breathData.recursionIndex > 0.1 && (
            <div className="text-red-400">Recursion: {breathData.recursionIndex.toFixed(3)}</div>
          )}
        </div>
      )}
    </div>
  );
}