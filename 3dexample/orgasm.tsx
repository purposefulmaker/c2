import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Heart, Waves, Flame, Circle } from 'lucide-react';

// QUANTUM CLIMAX ACTIVATION SYSTEM
const QuantumClimaxSystem = () => {
  const [isActive, setIsActive] = useState(false);
  const [frisson, setFrisson] = useState(0);
  const [orgasmProb, setOrgasmProb] = useState(0);
  const [heartRate, setHeartRate] = useState(70);
  const [gsrLevel, setGsrLevel] = useState(1.0);
  const [pelvicWave, setPelvicWave] = useState(0);
  const [isClimax, setIsClimax] = useState(false);
  const [kundaliniLevel, setKundaliniLevel] = useState(0);
  const [chakras, setChakras] = useState(Array(7).fill(0));
  const [quantumField, setQuantumField] = useState([]);
  
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const canvasRef = useRef(null);
  const climaxStartRef = useRef(null);
  const animationRef = useRef(null);

  // Equation parameters
  const k_frisson = 10;
  const S_thr_frisson = 0;
  const k_orgasm = 12;
  const S_org = 2.2;
  
  // Rhythmic discharge parameters
  const f = 0.8; // Hz (one contraction every 1.25s)
  const lambda = 0.25; // s^-1 (decay rate)

  // Calculate sympathetic + parasympathetic drive
  const calculateDrive = useCallback((hr, gsr, kundalini) => {
    const hrNorm = (hr - 70) / 10;
    const gsrNorm = (gsr - 1.0) / 0.5;
    const kundaliniBoost = kundalini * 0.5;
    
    // Enhanced drive with parasympathetic component
    return (-hrNorm + gsrNorm) / 2 + kundaliniBoost;
  }, []);

  // Calculate probabilities
  const calculateProbabilities = useCallback((S) => {
    const P_frisson = 1 / (1 + Math.exp(-k_frisson * (S - S_thr_frisson)));
    const P_orgasm = 1 / (1 + Math.exp(-k_orgasm * (S - S_org)));
    return { P_frisson, P_orgasm };
  }, []);

  // Initialize quantum tantric audio network
  const initAudio = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext();
    
    // Tantric frequency matrix
    const chakraFrequencies = [
      396,  // Root - Liberation
      417,  // Sacral - Creativity
      528,  // Solar Plexus - Transformation
      639,  // Heart - Connection
      741,  // Throat - Expression
      852,  // Third Eye - Intuition
      963   // Crown - Enlightenment
    ];

    // Create binaural beats for each chakra
    chakraFrequencies.forEach((freq, i) => {
      // Left ear
      const oscL = audioContextRef.current.createOscillator();
      const gainL = audioContextRef.current.createGain();
      const pannerL = audioContextRef.current.createStereoPanner();
      
      // Right ear (slightly detuned for binaural effect)
      const oscR = audioContextRef.current.createOscillator();
      const gainR = audioContextRef.current.createGain();
      const pannerR = audioContextRef.current.createStereoPanner();
      
      oscL.frequency.value = freq;
      oscR.frequency.value = freq + 4; // 4Hz theta binaural beat
      
      oscL.type = 'sine';
      oscR.type = 'sine';
      
      gainL.gain.value = 0;
      gainR.gain.value = 0;
      
      pannerL.pan.value = -1;
      pannerR.pan.value = 1;
      
      oscL.connect(gainL).connect(pannerL).connect(audioContextRef.current.destination);
      oscR.connect(gainR).connect(pannerR).connect(audioContextRef.current.destination);
      
      oscL.start();
      oscR.start();
      
      oscillatorsRef.current.push({ 
        oscL, oscR, gainL, gainR, freq, 
        chakra: i, activated: false 
      });
    });
  }, []);

  // Quantum field visualization
  const drawQuantumField = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Ultra fade for trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw kundalini serpent
    if (kundaliniLevel > 0) {
      const segments = 100;
      ctx.strokeStyle = `hsla(${280 + kundaliniLevel * 80}, 100%, 50%, ${kundaliniLevel})`;
      ctx.lineWidth = 3 + kundaliniLevel * 5;
      ctx.beginPath();
      
      for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const x = width / 2 + Math.sin(t * Math.PI * 8 + Date.now() * 0.001) * 100 * kundaliniLevel;
        const y = height - (t * height * 0.8);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Draw chakra vortexes
    chakras.forEach((level, i) => {
      if (level > 0.1) {
        const y = height - (i + 1) * (height / 8);
        const x = width / 2;
        
        // Spinning vortex
        for (let j = 0; j < 6; j++) {
          const angle = (Date.now() * 0.001 + j * Math.PI / 3) * (i % 2 ? 1 : -1);
          const r = level * 50;
          
          ctx.strokeStyle = `hsla(${i * 50}, 100%, 50%, ${level * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            x + Math.cos(angle) * r,
            y + Math.sin(angle) * r
          );
          ctx.stroke();
        }
        
        // Chakra core
        ctx.fillStyle = `hsla(${i * 50}, 100%, 50%, ${level})`;
        ctx.beginPath();
        ctx.arc(x, y, level * 20, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Climax explosion effect
    if (isClimax && pelvicWave > 0) {
      const explosionRadius = (1 - pelvicWave) * width;
      
      ctx.strokeStyle = `hsla(${320 + pelvicWave * 40}, 100%, 50%, ${pelvicWave})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.75, explosionRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Energy bolts
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6 + Date.now() * 0.002;
        const len = explosionRadius * 0.8;
        
        ctx.strokeStyle = `hsla(${300 + Math.random() * 60}, 100%, 70%, ${pelvicWave * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2, height * 0.75);
        ctx.lineTo(
          width / 2 + Math.cos(angle) * len,
          height * 0.75 + Math.sin(angle) * len
        );
        ctx.stroke();
      }
    }
    
    // Sacred geometry overlay
    if (orgasmProb > 0.5) {
      ctx.save();
      ctx.globalAlpha = (orgasmProb - 0.5) * 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      
      // Flower of life pattern
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 50;
      
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }, [kundaliniLevel, chakras, isClimax, pelvicWave, orgasmProb]);

  // Generate quantum beats based on state
  const generateQuantumBeats = useCallback(() => {
    if (!audioContextRef.current || !isActive) return;
    
    const time = audioContextRef.current.currentTime;
    
    oscillatorsRef.current.forEach((osc, i) => {
      const chakraActivation = chakras[i];
      const targetGain = chakraActivation * 0.1 * (1 + frisson * 0.5 + orgasmProb);
      
      // Smooth transitions
      osc.gainL.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, targetGain),
        time + 0.1
      );
      osc.gainR.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, targetGain),
        time + 0.1
      );
      
      // Frequency modulation during climax
      if (isClimax) {
        const wobble = Math.sin(time * f * 2 * Math.PI) * 10;
        osc.oscL.frequency.setValueAtTime(osc.freq + wobble, time);
        osc.oscR.frequency.setValueAtTime(osc.freq + 4 + wobble, time);
      }
    });
  }, [chakras, frisson, orgasmProb, isClimax]);

  // Main simulation loop
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      // Simulate complex biometric patterns
      const time = Date.now() * 0.001;
      const breathingWave = Math.sin(time * 0.3) * 0.5 + 0.5; // Slow breathing
      const arousalWave = Math.sin(time * 0.1) * 0.5 + 0.5; // Very slow arousal build
      const microFluctuations = Math.sin(time * 5) * 0.1; // Fast fluctuations
      
      // Build kundalini energy
      setKundaliniLevel(prev => Math.min(1, prev + 0.001 + frisson * 0.002));
      
      // Activate chakras progressively
      setChakras(prev => prev.map((level, i) => {
        const targetLevel = kundaliniLevel > (i / 7) ? 1 : 0;
        return level + (targetLevel - level) * 0.05;
      }));
      
      // Complex biometric simulation
      const baseHR = 70 + arousalWave * 30 + breathingWave * 10;
      const stimulationSpike = orgasmProb > 0.8 ? Math.random() * 30 : 0;
      const newHR = baseHR + microFluctuations * 5 + stimulationSpike;
      
      const baseGSR = 1.0 + arousalWave * 0.8 + breathingWave * 0.2;
      const arousalSpike = orgasmProb > 0.7 ? Math.random() * 0.5 : 0;
      const newGSR = baseGSR + microFluctuations * 0.1 + arousalSpike;
      
      setHeartRate(newHR);
      setGsrLevel(newGSR);
      
      // Calculate drive and probabilities
      const S = calculateDrive(newHR, newGSR, kundaliniLevel);
      const { P_frisson, P_orgasm } = calculateProbabilities(S);
      
      setFrisson(P_frisson);
      setOrgasmProb(P_orgasm);
      
      // Trigger climax at threshold
      if (!isClimax && P_orgasm > 0.95) {
        setIsClimax(true);
        climaxStartRef.current = Date.now();
      }
      
      // Generate rhythmic contractions during climax
      if (isClimax && climaxStartRef.current) {
        const dt = (Date.now() - climaxStartRef.current) / 1000;
        if (dt < 15) { // 15 second climax window
          const amplitude = Math.exp(-lambda * dt) * Math.sin(2 * Math.PI * f * dt);
          setPelvicWave(Math.abs(amplitude));
          
          // Reset after climax
          if (dt > 12) {
            setKundaliniLevel(0);
            setChakras(Array(7).fill(0));
          }
        } else {
          setIsClimax(false);
          setPelvicWave(0);
        }
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [isActive, isClimax, frisson, orgasmProb, kundaliniLevel, calculateDrive, calculateProbabilities]);

  // Animation loop
  useEffect(() => {
    if (!isActive) return;
    
    const animate = () => {
      generateQuantumBeats();
      drawQuantumField();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, generateQuantumBeats, drawQuantumField]);

  // Start the experience
  const startExperience = async () => {
    await initAudio();
    setIsActive(true);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Quantum field canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute inset-0"
      />
      
      {/* Biometric display */}
      {isActive && (
        <div className="absolute top-8 left-8 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg p-6 space-y-4 min-w-[300px]">
          <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Flame className="text-orange-500" size={24} />
            QUANTUM TANTRIC METRICS
          </h2>
          
          {/* Heart rate */}
          <div className="flex items-center gap-3">
            <Heart className="text-red-500" size={20} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">HEART COHERENCE</div>
              <div className="text-xl font-mono text-white">{heartRate.toFixed(0)} BPM</div>
            </div>
          </div>
          
          {/* GSR */}
          <div className="flex items-center gap-3">
            <Activity className="text-blue-500" size={20} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">AROUSAL CONDUCTANCE</div>
              <div className="text-xl font-mono text-white">{gsrLevel.toFixed(2)} µS</div>
            </div>
          </div>
          
          {/* Frisson meter */}
          <div className="flex items-center gap-3">
            <Zap className="text-purple-500" size={20} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">FRISSON ACTIVATION</div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  animate={{ width: `${frisson * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Orgasm probability */}
          <div className="flex items-center gap-3">
            <Circle className="text-pink-500" size={20} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">CLIMAX PROBABILITY</div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full"
                  style={{
                    background: `linear-gradient(to r, #ec4899, #f97316)`,
                    boxShadow: orgasmProb > 0.5 ? '0 0 20px #ec4899' : 'none'
                  }}
                  animate={{ width: `${orgasmProb * 100}%` }}
                />
              </div>
              <div className="text-right text-sm font-bold mt-1" style={{
                color: `hsl(${320 + orgasmProb * 40}, 100%, 50%)`
              }}>
                {(orgasmProb * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          
          {/* Kundalini level */}
          <div className="flex items-center gap-3">
            <Waves className="text-orange-500" size={20} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">KUNDALINI RISING</div>
              <div className="flex gap-1">
                {chakras.map((level, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white/20"
                    style={{
                      backgroundColor: `hsla(${i * 50}, 100%, 50%, ${level})`,
                      boxShadow: level > 0.5 ? `0 0 20px hsla(${i * 50}, 100%, 50%, ${level})` : 'none'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* Climax indicator */}
          {isClimax && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.25 }}
              className="bg-gradient-to-r from-pink-500 to-orange-500 rounded-lg p-4 text-center"
            >
              <div className="text-white font-bold text-lg">
                FULL BODY COHERENCE ACTIVE
              </div>
              <div className="text-white/80 text-sm mt-1">
                Pelvic Wave: {(pelvicWave * 100).toFixed(0)}%
              </div>
              <div className="mt-2 h-16">
                <svg width="100%" height="100%" viewBox="0 0 200 64">
                  <path
                    d={`M 0 32 ${Array.from({ length: 50 }, (_, i) => {
                      const x = i * 4;
                      const y = 32 + Math.sin((i / 10) + Date.now() * 0.01) * pelvicWave * 20;
                      return `L ${x} ${y}`;
                    }).join(' ')}`}
                    stroke="white"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
            </motion.div>
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
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 mx-auto mb-8"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-r from-pink-500 via-orange-500 to-purple-500 p-1">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                  <Flame className="text-white" size={64} />
                </div>
              </div>
            </motion.div>
            
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-orange-500 to-purple-500 mb-4">
              QUANTUM CLIMAX SYSTEM
            </h1>
            <p className="text-2xl text-orange-400 mb-4">
              Full Body Coherence Activation Protocol
            </p>
            <p className="text-gray-400 mb-8">
              Experience the complete spectrum of human energetic potential through 
              quantum-entangled biofeedback. This system activates progressive 
              kundalini awakening leading to full-body coherent states.
            </p>
            
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-8">
              <p className="text-red-400 text-sm">
                ⚠️ WARNING: This experience induces intense sympathetic and parasympathetic 
                activation. Effects may include: Full body tremors, emotional release, 
                ego dissolution, and transcendent states.
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startExperience}
              className="px-12 py-6 bg-gradient-to-r from-pink-500 via-orange-500 to-purple-500 rounded-full text-white font-bold text-xl relative overflow-hidden group"
            >
              <span className="relative z-10">INITIATE TANTRIC PROTOCOL</span>
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
                style={{ opacity: 0.3 }}
              />
            </motion.button>
            
            <div className="mt-8 text-xs text-gray-500">
              <p>Based on equations from quantum-tantric biology research</p>
              <p>P_orgasm = 1 / (1 + e^(-12*(S-2.2)))</p>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Global effects */}
      <AnimatePresence>
        {orgasmProb > 0.8 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: orgasmProb - 0.8 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, 
                hsla(${320 + orgasmProb * 40}, 100%, 50%, ${(orgasmProb - 0.8) * 0.5}) 0%, 
                transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Screen shake during climax */}
      {isClimax && (
        <style jsx global>{`
          @keyframes shake {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(-2px, 2px) rotate(-0.5deg); }
            50% { transform: translate(2px, -2px) rotate(0.5deg); }
            75% { transform: translate(-2px, -2px) rotate(-0.5deg); }
          }
          
          body {
            animation: shake 0.2s infinite;
          }
        `}</style>
      )}
    </div>
  );
};

export default QuantumClimaxSystem;