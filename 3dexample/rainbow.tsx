import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wind, Eye, Infinity } from 'lucide-react';

// RAINBOW BODY DISSOLUTION SYSTEM
const RainbowBodyDissolution = () => {
  const [isActive, setIsActive] = useState(false);
  const [breathSignal, setBreathSignal] = useState(0); // B(t)
  const [photonFlux, setPhotonFlux] = useState(0); // P(t)
  const [massRemaining, setMassRemaining] = useState(1); // m(t)/m₀
  const [luminousPower, setLuminousPower] = useState(0); // L(t)
  const [spectralDistribution, setSpectralDistribution] = useState([]);
  const [dissolvePhase, setDissolvePhase] = useState('solid'); // solid, translucent, luminous, rainbow, void
  const [energyRadiated, setEnergyRadiated] = useState(0);
  const [breathHistory, setBreathHistory] = useState([]);
  
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const startTimeRef = useRef(null);
  
  // Physical constants
  const c = 299792458; // m/s
  const h = 6.626e-34; // Planck constant
  const P_base = 100; // Base photon emission rate
  const k = 500; // Breath to photon conversion
  const alpha = 0.001; // Luminous power calibration
  const beta = 0.0001; // Mass decay rate
  const m0 = 70; // Initial mass (kg)

  // Initialize audio for breath detection and harmonic generation
  const initAudio = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext();
    
    // Create breathing detector
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const detectBreath = () => {
        analyser.getByteTimeDomainData(dataArray);
        const rms = Math.sqrt(
          dataArray.reduce((sum, val) => sum + Math.pow(val - 128, 2), 0) / dataArray.length
        ) / 128;
        
        setBreathSignal(rms);
        setBreathHistory(prev => [...prev.slice(-100), rms]);
      };
      
      const breathInterval = setInterval(detectBreath, 50);
      return () => clearInterval(breathInterval);
    } catch (error) {
      console.error('Microphone access denied, using simulated breath');
      // Simulate breath if no mic
      const simulateBreath = () => {
        const time = Date.now() * 0.001;
        const breath = (Math.sin(time * 0.3) * 0.5 + 0.5) * 
                      (1 + Math.sin(time * 2.1) * 0.1) *
                      (1 + Math.sin(time * 7.3) * 0.05);
        setBreathSignal(breath);
        setBreathHistory(prev => [...prev.slice(-100), breath]);
      };
      const interval = setInterval(simulateBreath, 50);
      return () => clearInterval(interval);
    }
  }, []);

  // Calculate photon flux from breath
  const calculatePhotonFlux = useCallback((B) => {
    return P_base + k * B;
  }, []);

  // Calculate spectral power density
  const calculateSpectralPower = useCallback((breathHistory) => {
    // Simple FFT approximation for visible spectrum
    const frequencies = [
      { f: 430e12, color: '#ff0000', name: 'Red' },
      { f: 510e12, color: '#ff8c00', name: 'Orange' },
      { f: 570e12, color: '#ffff00', name: 'Yellow' },
      { f: 600e12, color: '#00ff00', name: 'Green' },
      { f: 650e12, color: '#00ffff', name: 'Cyan' },
      { f: 700e12, color: '#0000ff', name: 'Blue' },
      { f: 750e12, color: '#8b00ff', name: 'Violet' }
    ];
    
    return frequencies.map((freq, i) => {
      // Simulate spectral components based on breath harmonics
      const harmonic = breathHistory.reduce((sum, val, j) => {
        return sum + val * Math.sin(2 * Math.PI * i * j / breathHistory.length);
      }, 0) / breathHistory.length;
      
      return {
        ...freq,
        power: Math.abs(harmonic) * luminousPower
      };
    });
  }, [luminousPower]);

  // Main physics loop
  useEffect(() => {
    if (!isActive) return;
    
    const physicsLoop = () => {
      // Calculate photon flux P(t)
      const P = calculatePhotonFlux(breathSignal);
      setPhotonFlux(P);
      
      // Calculate spectral distribution
      const spectrum = calculateSpectralPower(breathHistory);
      setSpectralDistribution(spectrum);
      
      // Calculate instantaneous luminous power L(t)
      const L = alpha * spectrum.reduce((sum, s) => sum + s.power, 0);
      setLuminousPower(L);
      
      // Update mass decay: m(t) = m₀ * e^(-β∫L(τ)dτ)
      setMassRemaining(prev => {
        const decay = Math.exp(-beta * L);
        return Math.max(0.001, prev * decay);
      });
      
      // Calculate total energy radiated: E = mc²(1 - m(t)/m₀)
      const E = m0 * c * c * (1 - massRemaining);
      setEnergyRadiated(E);
      
      // Update dissolution phase
      if (massRemaining > 0.8) setDissolvePhase('solid');
      else if (massRemaining > 0.5) setDissolvePhase('translucent');
      else if (massRemaining > 0.2) setDissolvePhase('luminous');
      else if (massRemaining > 0.05) setDissolvePhase('rainbow');
      else setDissolvePhase('void');
    };
    
    const interval = setInterval(physicsLoop, 50);
    return () => clearInterval(interval);
  }, [isActive, breathSignal, breathHistory, massRemaining, calculatePhotonFlux, calculateSpectralPower]);

  // Particle system for rainbow dissolution
  const updateParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear with fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, width, height);
    
    // Generate new particles based on photon flux
    const particlesToAdd = Math.floor(photonFlux / 10);
    for (let i = 0; i < particlesToAdd; i++) {
      const spectrum = spectralDistribution[Math.floor(Math.random() * spectralDistribution.length)];
      particlesRef.current.push({
        x: width / 2 + (Math.random() - 0.5) * 200 * (1 - massRemaining),
        y: height / 2 + (Math.random() - 0.5) * 300 * (1 - massRemaining),
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 3 - 2,
        color: spectrum?.color || '#ffffff',
        size: Math.random() * 3 + 1,
        life: 1
      });
    }
    
    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.05; // gravity
      particle.life -= 0.01;
      
      if (particle.life <= 0) return false;
      
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      
      return true;
    });
    
    // Draw dissolving body silhouette
    if (dissolvePhase !== 'void') {
      ctx.save();
      ctx.globalAlpha = massRemaining;
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 50 * (1 - massRemaining);
      ctx.shadowColor = 'white';
      
      // Simple human figure
      const scale = massRemaining;
      const cx = width / 2;
      const cy = height / 2;
      
      // Head
      ctx.beginPath();
      ctx.arc(cx, cy - 100 * scale, 30 * scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Body (getting more ethereal)
      if (dissolvePhase === 'solid' || dissolvePhase === 'translucent') {
        ctx.fillRect(cx - 40 * scale, cy - 70 * scale, 80 * scale, 120 * scale);
        // Arms
        ctx.fillRect(cx - 70 * scale, cy - 50 * scale, 30 * scale, 80 * scale);
        ctx.fillRect(cx + 40 * scale, cy - 50 * scale, 30 * scale, 80 * scale);
        // Legs
        ctx.fillRect(cx - 30 * scale, cy + 50 * scale, 25 * scale, 80 * scale);
        ctx.fillRect(cx + 5 * scale, cy + 50 * scale, 25 * scale, 80 * scale);
      }
      
      ctx.restore();
    }
    
    // Draw rainbow aura
    if (dissolvePhase === 'luminous' || dissolvePhase === 'rainbow') {
      spectralDistribution.forEach((spectrum, i) => {
        const angle = (i / spectralDistribution.length) * Math.PI * 2;
        const radius = 150 * (1 - massRemaining) + spectrum.power * 100;
        
        ctx.strokeStyle = spectrum.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = spectrum.power;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, angle - 0.5, angle + 0.5);
        ctx.stroke();
      });
    }
    
    // Draw "empty clothes" at void phase
    if (dissolvePhase === 'void') {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      // Simple robe outline
      ctx.beginPath();
      ctx.moveTo(width / 2 - 60, height / 2 + 150);
      ctx.lineTo(width / 2 - 40, height / 2);
      ctx.lineTo(width / 2 + 40, height / 2);
      ctx.lineTo(width / 2 + 60, height / 2 + 150);
      ctx.stroke();
    }
  }, [photonFlux, massRemaining, spectralDistribution, dissolvePhase]);

  // Animation loop
  useEffect(() => {
    if (!isActive) return;
    
    const animate = () => {
      updateParticles();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, updateParticles]);

  // Start the experience
  const startDissolution = async () => {
    await initAudio();
    startTimeRef.current = Date.now();
    setIsActive(true);
  };

  // Reset to physical form
  const reset = () => {
    setMassRemaining(1);
    setDissolvePhase('solid');
    setEnergyRadiated(0);
    particlesRef.current = [];
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute inset-0"
      />
      
      {/* Metrics display */}
      {isActive && (
        <div className="absolute top-8 left-8 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-6 space-y-4 min-w-[350px]">
          <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Infinity className="text-purple-500" size={24} />
            RAINBOW BODY METRICS
          </h2>
          
          {/* Breath signal */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wind className="text-blue-400" size={18} />
              <span className="text-xs text-gray-400">BREATH SIGNAL B(t)</span>
            </div>
            <div className="h-12 bg-gray-900 rounded overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 200 48">
                <path
                  d={`M 0 24 ${breathHistory.slice(-50).map((val, i) => 
                    `L ${i * 4} ${24 - val * 20}`
                  ).join(' ')}`}
                  stroke="#3b82f6"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
          </div>
          
          {/* Photon flux */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="text-yellow-400" size={18} />
              <span className="text-xs text-gray-400">PHOTON FLUX P(t)</span>
            </div>
            <span className="text-lg font-mono text-yellow-400">
              {photonFlux.toFixed(0)} γ/s
            </span>
          </div>
          
          {/* Mass remaining */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">MASS REMAINING m(t)/m₀</span>
              <span className="text-lg font-mono text-white">
                {(massRemaining * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-white to-transparent"
                animate={{ width: `${massRemaining * 100}%` }}
              />
            </div>
          </div>
          
          {/* Luminous power */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">LUMINOUS POWER L(t)</span>
            <span className="text-lg font-mono text-orange-400">
              {(luminousPower * 1000).toFixed(2)} mW
            </span>
          </div>
          
          {/* Spectral distribution */}
          <div>
            <span className="text-xs text-gray-400">SPECTRAL EMISSION</span>
            <div className="flex gap-1 mt-2">
              {spectralDistribution.map((spectrum, i) => (
                <div
                  key={i}
                  className="flex-1 rounded"
                  style={{
                    height: `${Math.max(4, spectrum.power * 40)}px`,
                    backgroundColor: spectrum.color,
                    opacity: 0.8
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Energy radiated */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">ENERGY RADIATED E(t)</span>
            <span className="text-lg font-mono text-purple-400">
              {(energyRadiated / 1e16).toFixed(3)} × 10¹⁶ J
            </span>
          </div>
          
          {/* Dissolution phase */}
          <div className="bg-purple-900/30 border border-purple-500/50 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="text-purple-400" size={18} />
              <span className="text-sm font-bold text-purple-400">
                PHASE: {dissolvePhase.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-gray-300">
              {dissolvePhase === 'solid' && 'Physical form intact'}
              {dissolvePhase === 'translucent' && 'Becoming translucent...'}
              {dissolvePhase === 'luminous' && 'Radiating inner light!'}
              {dissolvePhase === 'rainbow' && 'FULL SPECTRUM DISSOLUTION!'}
              {dissolvePhase === 'void' && 'Only robes remain... ✨'}
            </div>
          </div>
          
          {/* Equations display */}
          <div className="text-xs text-gray-500 font-mono space-y-1">
            <div>P(t) = P₀ + k·B(t)</div>
            <div>m(t) = m₀·e^(-β∫L(τ)dτ)</div>
            <div>E = mc²(1 - m(t)/m₀)</div>
          </div>
          
          {dissolvePhase === 'void' && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={reset}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold"
            >
              RECONSTITUTE FORM
            </motion.button>
          )}
        </div>
      )}
      
      {/* Start screen */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto px-8"
          >
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity }
              }}
              className="w-32 h-32 mx-auto mb-8"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 p-1">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                  <Infinity className="text-white" size={64} />
                </div>
              </div>
            </motion.div>
            
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 mb-4">
              RAINBOW BODY
            </h1>
            <p className="text-2xl text-purple-400 mb-4">
              Digital Dissolution Into Pure Light
            </p>
            <p className="text-gray-400 mb-8">
              Through coherent breathing and meditation, transform your digital essence 
              into pure photonic energy. Based on Dzogchen rainbow body physics where 
              m(t) → 0 as luminosity approaches infinity.
            </p>
            
            <div className="bg-purple-900/20 border border-purple-500/50 rounded-lg p-4 mb-8">
              <p className="text-purple-300 text-sm">
                "When the breath becomes perfectly coherent, the body's biophotons 
                amplify exponentially. Mass converts to radiant energy following E=mc². 
                Only the robes remain as witness to complete enlightenment."
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startDissolution}
              className="px-12 py-6 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-full text-white font-bold text-xl relative overflow-hidden group"
            >
              <span className="relative z-10">BEGIN DISSOLUTION</span>
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
                style={{ opacity: 0.3 }}
              />
            </motion.button>
            
            <div className="mt-8 text-xs text-gray-500">
              <p>Based on biophoton coherence & mass-energy equivalence</p>
              <p>Breathe deeply to accelerate photonic emission</p>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Rainbow glow overlay */}
      {isActive && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: dissolvePhase === 'rainbow' ? 
              `radial-gradient(circle at center, 
                hsla(${Date.now() * 0.1 % 360}, 100%, 50%, ${0.2 * (1 - massRemaining)}) 0%, 
                transparent 70%)` : 'none',
            animation: dissolvePhase === 'rainbow' ? 'hue-rotate 3s linear infinite' : 'none'
          }}
        />
      )}
      
      <style jsx>{`
        @keyframes hue-rotate {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RainbowBodyDissolution;