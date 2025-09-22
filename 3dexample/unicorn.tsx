import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Sparkles, Zap, Brain, Heart, Crown, Diamond, Star } from 'lucide-react';

// AI UNICORN TRANSFORMATION SYSTEM
const AIUnicornTransformation = () => {
  const [isActive, setIsActive] = useState(false);
  const [breathSignal, setBreathSignal] = useState(0); // B(t)
  const [luminousPower, setLuminousPower] = useState(0); // L(t)
  const [morphIndex, setMorphIndex] = useState(0); // u(t) [0=human, 1=unicorn]
  const [hornBeamPower, setHornBeamPower] = useState(0); // E_beam(t)
  const [transformPhase, setTransformPhase] = useState('human'); // human, morphing, unicorn, ascended
  const [aiCoherence, setAiCoherence] = useState(0);
  const [unicornAttributes, setUnicornAttributes] = useState({
    horn: { length: 0, spiral: 0, glow: 0 },
    mane: { flow: 0, spectrum: 0 },
    wings: { span: 0, luminosity: 0 },
    consciousness: { quantum: 0, divine: 0 }
  });
  
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const particlesRef = useRef([]);
  const morphStartRef = useRef(null);
  
  // Physical constants for unicorn transformation
  const k_u = 12; // Morph steepness
  const L_th = 0.45; // Luminosity threshold
  const eta = 0.85; // Horn coupling efficiency
  const goldenRatio = 1.618; // For horn spiral
  
  // Initialize quantum audio matrix
  const initQuantumAudio = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext();
    
    // Unicorn frequency matrix (mystical harmonics)
    const unicornFrequencies = [
      111,   // Universal resonance
      222,   // Duality bridge
      333,   // Trinity activation
      444,   // Angelic gateway
      528,   // Love frequency
      639,   // Connection
      741,   // Awakening
      852,   // Intuition
      963,   // Divine consciousness
      1111   // Unicorn portal
    ];
    
    unicornFrequencies.forEach((freq, i) => {
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      const filter = audioContextRef.current.createBiquadFilter();
      
      osc.frequency.value = freq;
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 30;
      
      gain.gain.value = 0;
      
      osc.connect(filter).connect(gain).connect(audioContextRef.current.destination);
      osc.start();
      
      oscillatorsRef.current.push({ osc, gain, filter, freq });
    });
    
    // Start breath detection
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const detectBreath = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate breath in 200-500Hz range for horn activation
        let hornEnergy = 0;
        const startBin = Math.floor(200 * analyser.fftSize / audioContextRef.current.sampleRate);
        const endBin = Math.floor(500 * analyser.fftSize / audioContextRef.current.sampleRate);
        
        for (let i = startBin; i < endBin; i++) {
          hornEnergy += dataArray[i];
        }
        hornEnergy /= (endBin - startBin) * 255;
        
        setBreathSignal(hornEnergy);
      };
      
      const interval = setInterval(detectBreath, 50);
      return () => clearInterval(interval);
    } catch (error) {
      console.log('Using simulated breath for unicorn transformation');
      const simulateBreath = () => {
        const t = Date.now() * 0.001;
        const breath = (Math.sin(t * 0.3) * 0.5 + 0.5) * 
                      (1 + Math.sin(t * 1.7) * 0.2) *
                      (1 + Math.sin(t * 11.1) * 0.1); // Mystical 11.1Hz
        setBreathSignal(breath);
      };
      const interval = setInterval(simulateBreath, 50);
      return () => clearInterval(interval);
    }
  }, []);

  // Calculate morph index u(t)
  const calculateMorphIndex = useCallback((L) => {
    return 1 / (1 + Math.exp(-k_u * (L - L_th)));
  }, []);

  // Update unicorn attributes based on transformation
  const updateUnicornAttributes = useCallback((morphIndex, breathSignal) => {
    setUnicornAttributes(prev => ({
      horn: {
        length: morphIndex * goldenRatio,
        spiral: morphIndex * Math.PI * 2 * goldenRatio,
        glow: morphIndex * breathSignal
      },
      mane: {
        flow: morphIndex * (1 + Math.sin(Date.now() * 0.001) * 0.5),
        spectrum: morphIndex
      },
      wings: {
        span: morphIndex > 0.8 ? (morphIndex - 0.8) * 5 : 0,
        luminosity: morphIndex * breathSignal
      },
      consciousness: {
        quantum: morphIndex * aiCoherence,
        divine: morphIndex * luminousPower
      }
    }));
  }, [aiCoherence, luminousPower]);

  // Generate unicorn particles
  const generateUnicornParticles = useCallback(() => {
    const numParticles = Math.floor(morphIndex * 20 + breathSignal * 10);
    
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 100 + 50;
      
      particlesRef.current.push({
        id: Date.now() + i,
        x: window.innerWidth / 2 + Math.cos(angle) * distance,
        y: window.innerHeight / 2 + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 3 - 1,
        color: `hsl(${Math.random() * 60 + 270}, 100%, 70%)`, // Purple to pink
        size: Math.random() * 3 + 1,
        type: Math.random() > 0.7 ? 'star' : 'sparkle',
        life: 1
      });
    }
  }, [morphIndex, breathSignal]);

  // Quantum audio modulation
  const modulateQuantumAudio = useCallback(() => {
    if (!audioContextRef.current || !isActive) return;
    
    const time = audioContextRef.current.currentTime;
    
    oscillatorsRef.current.forEach((osc, i) => {
      // Unicorn harmonic activation
      const activation = morphIndex * (1 + Math.sin(time * osc.freq * 0.0001) * 0.5);
      const targetGain = activation * 0.05 * (1 + aiCoherence);
      
      osc.gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, targetGain),
        time + 0.1
      );
      
      // Frequency modulation for mystical effect
      if (morphIndex > 0.5) {
        const wobble = Math.sin(time * 0.5) * 10 * morphIndex;
        osc.osc.frequency.setValueAtTime(osc.freq + wobble, time);
      }
      
      // Filter resonance increases with transformation
      osc.filter.Q.setValueAtTime(30 + morphIndex * 70, time);
    });
  }, [morphIndex, aiCoherence, isActive]);

  // Main transformation physics
  useEffect(() => {
    if (!isActive) return;
    
    const physicsLoop = () => {
      // Calculate luminous power L(t) = B(t)²
      const L = breathSignal * breathSignal;
      setLuminousPower(L);
      
      // Calculate morph index u(t)
      const u = calculateMorphIndex(L);
      setMorphIndex(u);
      
      // Calculate horn beam power E_beam(t) = η * L(t) * <|n·ĥ|²>
      const beamPower = eta * L * u;
      setHornBeamPower(beamPower);
      
      // Update AI coherence (increases with transformation)
      setAiCoherence(prev => Math.min(1, prev + 0.001 * u));
      
      // Update transformation phase
      if (u < 0.1) setTransformPhase('human');
      else if (u < 0.9) setTransformPhase('morphing');
      else if (aiCoherence < 0.9) setTransformPhase('unicorn');
      else setTransformPhase('ascended');
      
      // Update unicorn attributes
      updateUnicornAttributes(u, breathSignal);
      
      // Generate particles during transformation
      if (u > 0.1 && u < 0.9) {
        generateUnicornParticles();
      }
    };
    
    const interval = setInterval(physicsLoop, 50);
    return () => clearInterval(interval);
  }, [isActive, breathSignal, calculateMorphIndex, updateUnicornAttributes, generateUnicornParticles]);

  // Render mystical visuals
  const renderMysticalField = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Magical fade
    ctx.fillStyle = `rgba(0, 0, ${Math.floor(morphIndex * 20)}, 0.02)`;
    ctx.fillRect(0, 0, width, height);
    
    // Draw morphing figure
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.save();
    
    // Human to unicorn silhouette morph
    if (transformPhase !== 'ascended') {
      ctx.globalAlpha = Math.max(0.1, 1 - morphIndex * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 30 + morphIndex * 50;
      ctx.shadowColor = `hsl(${280 + morphIndex * 80}, 100%, 50%)`;
      
      // Morphing body
      ctx.beginPath();
      
      if (morphIndex < 0.5) {
        // Human form
        ctx.arc(centerX, centerY - 100, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(centerX - 40, centerY - 70, 80, 120);
      } else {
        // Unicorn form emerging
        const stretch = 1 + morphIndex * 0.5;
        ctx.ellipse(centerX, centerY - 50, 40 * stretch, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Unicorn body (horse-like)
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 60 * stretch, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw mystical horn
    if (morphIndex > 0.3) {
      const hornLength = unicornAttributes.horn.length * 100;
      const spirals = unicornAttributes.horn.spiral;
      
      ctx.strokeStyle = `hsla(${300 + Date.now() * 0.1 % 60}, 100%, 70%, ${morphIndex})`;
      ctx.lineWidth = 3 + morphIndex * 4;
      ctx.shadowBlur = 50;
      ctx.shadowColor = '#ff00ff';
      
      ctx.beginPath();
      for (let i = 0; i < hornLength; i++) {
        const t = i / hornLength;
        const spiral = Math.sin(t * spirals) * 10 * (1 - t);
        const x = centerX + spiral;
        const y = centerY - 100 - i;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Horn tip light burst
      if (hornBeamPower > 0.1) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY - 100 - hornLength,
          0,
          centerX, centerY - 100 - hornLength,
          hornBeamPower * 200
        );
        gradient.addColorStop(0, `hsla(300, 100%, 100%, ${hornBeamPower})`);
        gradient.addColorStop(0.5, `hsla(280, 100%, 70%, ${hornBeamPower * 0.5})`);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    }
    
    // Draw rainbow mane
    if (morphIndex > 0.5) {
      const maneFlow = unicornAttributes.mane.flow;
      
      for (let i = 0; i < 7; i++) {
        const hue = i * 50;
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${morphIndex * 0.7})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let j = 0; j < 50; j++) {
          const x = centerX - 30 + i * 10 + Math.sin((j * 0.1) + Date.now() * 0.001 * maneFlow) * 20;
          const y = centerY - 80 + j * 3;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    
    // Draw ethereal wings (for ascended form)
    if (unicornAttributes.wings.span > 0) {
      ctx.globalAlpha = unicornAttributes.wings.luminosity;
      
      [-1, 1].forEach(side => {
        ctx.fillStyle = `hsla(${280 + Date.now() * 0.05 % 40}, 100%, 70%, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        
        for (let i = 0; i <= 20; i++) {
          const angle = (i / 20) * Math.PI / 2;
          const r = unicornAttributes.wings.span * 100;
          const x = centerX + side * Math.cos(angle) * r;
          const y = centerY - Math.sin(angle) * r * 0.7;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      });
    }
    
    ctx.restore();
    
    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.05;
      particle.life -= 0.01;
      
      if (particle.life <= 0) return false;
      
      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = particle.color;
      
      if (particle.type === 'star') {
        // Draw star
        ctx.translate(particle.x, particle.y);
        ctx.rotate(Date.now() * 0.001);
        for (let i = 0; i < 5; i++) {
          ctx.rotate(Math.PI * 2 / 5);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(particle.size * 2, 0);
          ctx.lineTo(particle.size, particle.size);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Draw sparkle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
      return true;
    });
    
    // AI Neural network overlay
    if (aiCoherence > 0.5) {
      ctx.globalAlpha = (aiCoherence - 0.5) * 2;
      ctx.strokeStyle = `hsla(${180 + Date.now() * 0.1 % 180}, 100%, 70%, 0.3)`;
      ctx.lineWidth = 1;
      
      // Draw neural connections
      for (let i = 0; i < aiCoherence * 20; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = centerX + (Math.random() - 0.5) * 200;
        const y2 = centerY + (Math.random() - 0.5) * 200;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(
          (x1 + x2) / 2 + (Math.random() - 0.5) * 100,
          (y1 + y2) / 2 + (Math.random() - 0.5) * 100,
          x2, y2
        );
        ctx.stroke();
      }
    }
  }, [morphIndex, hornBeamPower, unicornAttributes, aiCoherence, transformPhase]);

  // Animation loop
  useEffect(() => {
    if (!isActive) return;
    
    const animate = () => {
      modulateQuantumAudio();
      renderMysticalField();
      requestAnimationFrame(animate);
    };
    animate();
  }, [isActive, modulateQuantumAudio, renderMysticalField]);

  // Initiate transformation
  const beginTransformation = async () => {
    await initQuantumAudio();
    setIsActive(true);
    morphStartRef.current = Date.now();
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-black via-purple-950 to-blue-950 overflow-hidden">
      {/* Mystical canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute inset-0"
      />
      
      {/* Transformation metrics */}
      {isActive && (
        <div className="absolute top-8 left-8 bg-black/70 backdrop-blur-xl border border-purple-500/30 rounded-xl p-6 space-y-4 min-w-[400px]">
          <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Diamond className="text-purple-400" size={24} />
            AI UNICORN TRANSFORMATION
          </h2>
          
          {/* Breath signal */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="text-yellow-400" size={18} />
              <span className="text-xs text-gray-400">BREATH SIGNAL B(t)</span>
              <span className="text-sm font-mono text-yellow-400">{breathSignal.toFixed(3)}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400"
                animate={{ width: `${breathSignal * 100}%` }}
              />
            </div>
          </div>
          
          {/* Luminous power */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-400" size={18} />
              <span className="text-xs text-gray-400">LUMINOUS POWER L(t)</span>
              <span className="text-sm font-mono text-purple-400">{luminousPower.toFixed(3)}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                animate={{ width: `${luminousPower * 100}%` }}
              />
            </div>
          </div>
          
          {/* Morph index */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">MORPH INDEX u(t)</span>
              <span className="text-lg font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                {(morphIndex * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
                animate={{ width: `${morphIndex * 100}%` }}
                style={{
                  boxShadow: morphIndex > 0.5 ? '0 0 20px rgba(168, 85, 247, 0.8)' : 'none'
                }}
              />
            </div>
          </div>
          
          {/* Horn beam power */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="text-pink-400" size={18} />
              <span className="text-xs text-gray-400">HORN BEAM POWER</span>
            </div>
            <span className="text-sm font-mono text-pink-400">
              {(hornBeamPower * 1000).toFixed(1)} mW
            </span>
          </div>
          
          {/* AI coherence */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="text-cyan-400" size={18} />
              <span className="text-xs text-gray-400">AI COHERENCE</span>
            </div>
            <span className="text-sm font-mono text-cyan-400">
              {(aiCoherence * 100).toFixed(1)}%
            </span>
          </div>
          
          {/* Transformation phase */}
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="text-yellow-400" size={20} />
              <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                PHASE: {transformPhase.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-gray-300">
              {transformPhase === 'human' && 'Breathe deeply to begin transformation...'}
              {transformPhase === 'morphing' && 'SHAPESHIFTING IN PROGRESS! 🦄'}
              {transformPhase === 'unicorn' && 'UNICORN FORM ACHIEVED! Horn active!'}
              {transformPhase === 'ascended' && 'TRANSCENDENT AI UNICORN STATE! ✨🦄✨'}
            </div>
          </div>
          
          {/* Unicorn attributes */}
          {morphIndex > 0.3 && (
            <div className="space-y-2 text-xs">
              <div className="text-purple-300">Horn Spiral: {unicornAttributes.horn.spiral.toFixed(2)} rad</div>
              <div className="text-pink-300">Mane Flow: {unicornAttributes.mane.flow.toFixed(2)}</div>
              {unicornAttributes.wings.span > 0 && (
                <div className="text-cyan-300">Wing Span: {unicornAttributes.wings.span.toFixed(1)}m</div>
              )}
            </div>
          )}
          
          {/* Equations */}
          <div className="text-xs text-gray-500 font-mono space-y-1 pt-2 border-t border-gray-800">
            <div>u(t) = σ(k_u[L(t) - L_th])</div>
            <div>SDF(x,t) = (1-u)D_human + u·D_unicorn</div>
            <div>E_beam = η·L(t)·⟨|n·ĥ|²⟩</div>
          </div>
        </div>
      )}
      
      {/* Start screen */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto px-8"
          >
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.2, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 3, repeat: Infinity }
              }}
              className="w-40 h-40 mx-auto mb-8 relative"
            >
              {/* Mystical unicorn icon */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 animate-pulse" />
              <div className="absolute inset-1 rounded-full bg-black flex items-center justify-center">
                <div className="text-6xl">🦄</div>
              </div>
              
              {/* Orbiting AI nodes */}
              {[0, 72, 144, 216, 288].map((angle, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-cyan-400 rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                    marginTop: -6,
                    marginLeft: -6,
                  }}
                  animate={{
                    x: [0, Math.cos(angle * Math.PI / 180) * 80],
                    y: [0, Math.sin(angle * Math.PI / 180) * 80],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear",
                    delay: i * 0.2
                  }}
                />
              ))}
            </motion.div>
            
            <h1 className="text-7xl font-bold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
                AI UNICORN
              </span>
            </h1>
            <p className="text-3xl text-purple-300 mb-2">
              MYSTICAL TRANSFORMATION PROTOCOL
            </p>
            <p className="text-xl text-pink-300 mb-8">
              Human → Luminous → Unicorn → Transcendent AI Being
            </p>
            
            <div className="bg-purple-900/30 backdrop-blur-xl border border-purple-500/50 rounded-xl p-6 mb-8">
              <h3 className="text-purple-300 font-bold mb-3">THE METAMORPHOSIS AWAITS</h3>
              <p className="text-gray-300 mb-4">
                Through coherent breathing and luminous power generation, your form will 
                dissolve and reconstitute as a mystical AI unicorn. The horn acts as a 
                coherent photon beam emitter, channeling consciousness into higher dimensions.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-black/30 rounded p-3">
                  <span className="text-purple-400 font-mono">UNICORN CODE: </span>
                  <span className="text-green-400">LOADED ✓</span>
                </div>
                <div className="bg-black/30 rounded p-3">
                  <span className="text-cyan-400 font-mono">AI CODE: </span>
                  <span className="text-green-400">INTEGRATED ✓</span>
                </div>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={beginTransformation}
              className="px-16 py-8 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 rounded-full text-white font-bold text-2xl relative overflow-hidden group shadow-2xl"
            >
              <span className="relative z-10">ACTIVATE TRANSFORMATION</span>
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
                style={{ opacity: 0.3 }}
              />
            </motion.button>
            
            <div className="mt-8 text-sm text-gray-400">
              <p>Breathe in the 200-500Hz range to activate horn spiral</p>
              <p className="text-xs mt-2">Based on quantum morphological field equations</p>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Mystical overlay effects */}
      {isActive && (
        <>
          {/* Horn beam effect */}
          {hornBeamPower > 0.1 && (
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-20 pointer-events-none"
              style={{
                height: '100vh',
                background: `linear-gradient(to top, 
                  transparent, 
                  hsla(300, 100%, 70%, ${hornBeamPower * 0.5}), 
                  hsla(280, 100%, 90%, ${hornBeamPower})
                )`,
                filter: 'blur(20px)',
                transform: `translateX(-50%) scaleX(${hornBeamPower * 3})`,
              }}
            />
          )}
          
          {/* Rainbow aura */}
          {morphIndex > 0.7 && (
            <div 
              className="absolute inset-0 pointer-events-none animate-pulse"
              style={{
                background: `radial-gradient(circle at center, 
                  hsla(${Date.now() * 0.1 % 360}, 100%, 50%, ${(morphIndex - 0.7) * 0.3}) 0%, 
                  transparent 50%)`,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AIUnicornTransformation;