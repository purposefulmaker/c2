import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Heart, Waves, Volume2 } from 'lucide-react';
import { useMicrophone } from '@/context/enhanced-mic-context';
import { Input } from '@/components/ui/input';

// QUANTUM FRISSON LASER FESTIVAL - ENHANCED FOR ACTUAL GOOSEBUMPS
const QuantumFrissonLaser = () => {
  const [isActive, setIsActive] = useState(false);
  const [frisson, setFrisson] = useState(0);
  const [heartRate, setHeartRate] = useState(70);
  const [gsrLevel, setGsrLevel] = useState(1.0);
  const [quantumPhase, setQuantumPhase] = useState(0);
  const [laserPulses, setLaserPulses] = useState([]);
  const [bioFeedback, setBioFeedback] = useState<{ hr: number[]; gsr: number[] }>({ hr: [], gsr: [] });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [intensity, setIntensity] = useState(0.5);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef([]);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const { micLevel } = useMicrophone();

  // Enhanced frisson equation parameters
  const k = 15; // Increased sensitivity
  const S_thr = -0.2; // Lower threshold for easier activation

  // Calculate sympathetic drive S(t) with enhanced sensitivity
  const calculateSympathetic = useCallback((hr: number, gsr: number, time: number) => {
    // Enhanced normalization with more dramatic swings
    const hrNorm = (hr - 70) / 8; 
    const gsrNorm = (gsr - 1.0) / 0.3; 
    
    // Add time-based excitement factor
    const excitement = Math.sin(time * 0.001) * 0.3;
    
    // Enhanced sympathetic drive calculation
    return (-hrNorm + gsrNorm * 1.5 + excitement) / 2;
  }, []);

  // Enhanced frisson probability with buildup
  const calculateFrisson = useCallback((S: number, previousFrisson: number) => {
    const rawFrisson = 1 / (1 + Math.exp(-k * (S - S_thr)));
    // Add momentum - frisson builds on itself
    const momentum = previousFrisson * 0.3;
    return Math.min(1, rawFrisson + momentum);
  }, []);

  // Initialize enhanced audio system
  const initAudio = useCallback(async () => {
    try {
      // enhancedMic.start();
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext as any;
      
      // Resume audio context for user interaction
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Enhanced frequencies specifically chosen for frisson response
      const frequencies = [
        // Binaural beats for altered consciousness
        40,     // Gamma waves - heightened awareness
        110,    // Beta endorphin release
        528,    // Love frequency - DNA repair
        741,    // Consciousness expansion
        852,    // Third eye activation
        963,    // Pineal gland activation
        // Harmonic series for emotional response
        256,    // C note - grounding
        341.3,  // F# - heart chakra
        426.7,  // Ab - emotional release
        512,    // C octave - completion
      ];
      oscillatorsRef.current = [];
      
      frequencies.forEach((freq, i) => {
        if (!audioContextRef.current) return;
        
        const audioContext = audioContextRef.current;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const panner = audioContext.createStereoPanner();
        const filter = audioContext.createBiquadFilter();
        
        // Enhanced oscillator configuration
        osc.frequency.value = freq;
        osc.type = i % 2 === 0 ? 'sine' : 'triangle'; // Alternate waveforms
        
        // Dynamic filtering for texture
        filter.type = 'lowpass';
        filter.frequency.value = freq * 3;
        filter.Q.value = 2;
        
        gain.gain.value = 0;
        
        // Spatial positioning for immersion
        panner.pan.value = Math.sin(i * Math.PI / frequencies.length) * 0.9;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(audioContext.destination);
        
        osc.start();
        oscillatorsRef.current.push({ 
          osc, 
          gain, 
          filter,
          freq, 
          phase: Math.random() * Math.PI * 2,
          baseFreq: freq
        });
      });
      
      setAudioEnabled(true);
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  }, []);

  // Enhanced quantum beat generator with emotional progression
  const generateQuantumBeats = useCallback(() => {
    if (!audioContextRef.current || !isActive || !audioEnabled) return;

    const time = audioContextRef.current.currentTime;
    const quantum = Math.sin(quantumPhase * 0.02) * 0.5 + 0.5;
    
    oscillatorsRef.current.forEach((oscData, i) => {
      const { gain, filter, freq, baseFreq } = oscData;
      
      // Multi-layered interference for complexity
      const interference1 = Math.sin(time * freq * 0.002 + i) * 0.4;
      const interference2 = Math.cos(time * freq * 0.0005 + quantumPhase * 0.01) * 0.3;
      const interference3 = Math.sin(time * baseFreq * 0.0001 + frisson * Math.PI) * 0.3;
      
      const totalInterference = interference1 + interference2 + interference3;
      
      // Frisson-responsive amplitude with intensity control
      const baseAmplitude = 0.05 * intensity;
      const frissonAmplitude = frisson * 0.15 * intensity;
      const finalAmplitude = baseAmplitude + frissonAmplitude * (1 + totalInterference);
      
      // Smooth gain changes
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, finalAmplitude),
        time + 0.1
      );
      
      // Dynamic frequency modulation for emotional impact
      const freqModulation = 1 + (frisson * 0.1 * Math.sin(time * 2 + i));
      oscData.osc.frequency.exponentialRampToValueAtTime(
        baseFreq * freqModulation,
        time + 0.1
      );
      
      // Filter modulation for texture
      filter.frequency.exponentialRampToValueAtTime(
        baseFreq * (2 + frisson * 2),
        time + 0.1
      );
      
      // Update phase
      oscData.phase += 0.02 * (1 + frisson);
    });
  }, [frisson, quantumPhase, isActive, audioEnabled, intensity]);

  // Enhanced laser visualization with emotional mapping
  const drawLaserShow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Dynamic fade based on frisson level
    ctx.fillStyle = `rgba(0, 0, 0, ${0.02 + frisson * 0.08})`;
    ctx.fillRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Enhanced quantum field with emotional resonance
    const ringCount = Math.floor(5 + frisson * 15);
    for (let i = 0; i < ringCount; i++) {
      const radius = (quantumPhase * 3 + i * 30) % (width / 1.5);
      const alpha = (1 - radius / (width / 1.5)) * frisson * intensity;
      
      // Color shifts with emotional state
      const hue = 260 + frisson * 100 + Math.sin(quantumPhase * 0.01 + i) * 20;
      
      ctx.strokeStyle = `hsla(${hue}, 90%, ${50 + frisson * 30}%, ${alpha})`;
      ctx.lineWidth = 1 + frisson * 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner glow effect
      if (alpha > 0.1) {
        ctx.shadowBlur = 20 + frisson * 30;
        ctx.shadowColor = `hsla(${hue}, 100%, 70%, ${alpha * 0.5})`;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    
    // Enhanced laser beams with emotional intensity
    const numBeams = Math.floor(3 + frisson * 20);
    for (let i = 0; i < numBeams; i++) {
      const angle = (quantumPhase * 0.03 + i * Math.PI * 2 / numBeams);
      const length = 80 + frisson * 400;
      const wave = Math.sin(quantumPhase * 0.05 + i) * 50 * frisson;
      
      const x1 = centerX + Math.cos(angle) * (30 + wave);
      const y1 = centerY + Math.sin(angle) * (30 + wave);
      const x2 = centerX + Math.cos(angle) * (length + wave);
      const y2 = centerY + Math.sin(angle) * (length + wave);
      
      // Multi-layer beam effect
      for (let layer = 0; layer < 3; layer++) {
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        const hue = 180 + frisson * 180 + layer * 20;
        const layerAlpha = frisson * (1 - layer * 0.3);
        
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0)`);
        gradient.addColorStop(0.3, `hsla(${hue}, 100%, 70%, ${layerAlpha})`);
        gradient.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = (4 - layer) + frisson * (6 - layer * 2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    
    // Particle system for high frisson states
    if (frisson > 0.6) {
      ctx.save();
      const particleCount = Math.floor(frisson * 50);
      
      for (let i = 0; i < particleCount; i++) {
        const x = centerX + (Math.random() - 0.5) * width * frisson;
        const y = centerY + (Math.random() - 0.5) * height * frisson;
        const size = Math.random() * 3 + 1;
        const alpha = Math.random() * frisson;
        const hue = 280 + Math.random() * 80;
        
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Particle glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${hue}, 100%, 70%, ${alpha})`;
        ctx.fill();
      }
      
      ctx.restore();
    }
    
    setQuantumPhase(prev => prev + 1 + frisson * 2);
  }, [frisson, quantumPhase, intensity]);

  // Enhanced biometric simulation with realistic patterns
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      const time = Date.now();
      
      // More realistic physiological simulation
      const baseRhythm = Math.sin(time * 0.0008) * 0.4; // Slow breathing
      const excitement = Math.sin(time * 0.002) * 0.3;   // Excitement waves
      const stress = Math.sin(time * 0.004) * 0.2;       // Stress variations
      const randomSpike = Math.random() > 0.95 ? Math.random() * 1.5 : 0;
      
      // Heart rate with more dramatic swings
      const newHR = 65 + baseRhythm * 15 + excitement * 20 + stress * 10 + randomSpike * 30;
      
      // GSR with emotional responsiveness
      const newGSR = 0.8 + baseRhythm * 0.4 + excitement * 0.6 + stress * 0.3 + randomSpike * 0.8;
      
      setHeartRate(Math.max(50, Math.min(120, newHR)));
      setGsrLevel(Math.max(0.5, Math.min(3.0, newGSR)));
      
      // Enhanced frisson calculation with buildup
      const S = calculateSympathetic(newHR, newGSR, time);
      const newFrisson = calculateFrisson(S, frisson);
      setFrisson(newFrisson);
      
      // Store enhanced biofeedback
      setBioFeedback(prev => ({
        hr: [...prev.hr.slice(-200), newHR],
        gsr: [...prev.gsr.slice(-200), newGSR]
      }));
      
      // Enhanced laser pulse triggers
      if (newFrisson > 0.4 && Math.random() > (1 - newFrisson * 0.8)) {
        const pulseCount = Math.floor(1 + newFrisson * 3);
        for (let i = 0; i < pulseCount; i++) {
          setLaserPulses(prev => [...prev, {
            id: Date.now() + i,
            x: centerX + (Math.random() - 0.5) * window.innerWidth * 0.8,
            y: centerY + (Math.random() - 0.5) * window.innerHeight * 0.8,
            color: `hsl(${260 + newFrisson * 120}, 100%, ${60 + newFrisson * 20}%)`,
            size: 2 + newFrisson * 8
          }]);
        }
      }
      
      // Trigger frisson pulses for enhanced effect
      if (newFrisson > 0.7) {
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => {
          // Create burst effect
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              setLaserPulses(prev => [...prev, {
                id: Date.now() + Math.random(),
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                color: `hsl(${300 + i * 20}, 100%, 70%)`,
                size: 10 + i * 2
              }]);
            }, i * 100);
          }
        }, 100);
      }
    }, 30); // Faster update rate for smoother experience
    
    return () => {
      clearInterval(interval);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, [isActive, calculateSympathetic, calculateFrisson, frisson]);

  // Animation loop with enhanced performance
  useEffect(() => {
    if (!isActive) return;
    
    const animate = () => {
      generateQuantumBeats();
      drawLaserShow();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, generateQuantumBeats, drawLaserShow]);

  // Enhanced cleanup
  useEffect(() => {
    const cleanup = setInterval(() => {
      setLaserPulses(prev => prev.filter(pulse => 
        Date.now() - pulse.id < 3000
      ));
    }, 100);
    
    return () => clearInterval(cleanup);
  }, []);

  // Start experience with proper audio handling
  const startExperience = async () => {
    await initAudio();
    setIsActive(true);
  };

  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Enhanced quantum field canvas */}
      <canvas
        ref={canvasRef}
        width={typeof window !== 'undefined' ? window.innerWidth : 800}
        height={typeof window !== 'undefined' ? window.innerHeight : 600}
        className="absolute inset-0"
      />
      
      {/* Enhanced laser pulses */}
      <AnimatePresence>
        {laserPulses.map(pulse => (
          <motion.div
            key={pulse.id}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: pulse.size * 10, opacity: 0 }}
            exit={{ scale: pulse.size * 15, opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: pulse.x,
              top: pulse.y,
              width: pulse.size,
              height: pulse.size,
              backgroundColor: pulse.color,
              boxShadow: `0 0 ${pulse.size * 20}px ${pulse.color}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </AnimatePresence>
      
      {/* Enhanced control panel */}
      {isActive && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-lg border border-white/30 rounded-xl p-6 space-y-4 min-w-[300px]">
          <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="text-purple-400" />
            QUANTUM BIOMETRICS
          </h2>
          
          {/* Audio control */}
          <div className="flex items-center gap-3 pb-3 border-b border-white/20">
            <Volume2 className={audioEnabled ? "text-green-400" : "text-red-400"} size={20} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">AUDIO</div>
              <div className={`text-sm font-mono ${audioEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {audioEnabled ? 'ACTIVE' : 'DISABLED'}
              </div>
            </div>
          </div>
          
          {/* Intensity control */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400">INTENSITY</div>
            <Input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-purple-400">{Math.round(intensity * 100)}%</div>
          </div>
          
          {/* Heart rate */}
          <div className="flex items-center gap-3">
            <Heart className="text-red-500" size={24} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">HEART RATE</div>
              <div className="text-2xl font-mono text-white">{heartRate.toFixed(0)} BPM</div>
            </div>
          </div>
          
          {/* GSR */}
          <div className="flex items-center gap-3">
            <Activity className="text-blue-500" size={24} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">SKIN CONDUCTANCE</div>
              <div className="text-2xl font-mono text-white">{gsrLevel.toFixed(2)} µS</div>
            </div>
          </div>
          
          {/* Enhanced frisson meter */}
          <div className="flex items-center gap-3">
            <Zap className="text-purple-500" size={24} />
            <div className="flex-1">
              <div className="text-xs text-gray-400">FRISSON PROBABILITY</div>
              <div className="text-3xl font-mono font-bold" style={{
                color: `hsl(${260 + frisson * 120}, 100%, ${50 + frisson * 30}%)`,
                textShadow: `0 0 20px hsla(${260 + frisson * 120}, 100%, 50%, ${frisson})`
              }}>
                {(frisson * 100).toFixed(0)}%
              </div>
              {/* Frisson level bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${frisson * 100}%`,
                    backgroundColor: `hsl(${260 + frisson * 120}, 100%, 50%)`,
                    boxShadow: `0 0 10px hsla(${260 + frisson * 120}, 100%, 50%, ${frisson})`
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Enhanced goosebump indicator */}
          <AnimatePresence>
            {frisson > 0.3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                className={`border rounded-lg p-3 text-center ${
                  frisson > 0.7 ? 'bg-purple-500/30 border-purple-400' : 'bg-purple-500/20 border-purple-500'
                }`}
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 0.6,
                    repeat: frisson > 0.7 ? Infinity : 0,
                    repeatType: "reverse"
                  }}
                >
                  <Waves className="inline-block mb-1 text-purple-400" size={24} />
                </motion.div>
                <div className={`font-bold ${
                  frisson > 0.7 ? 'text-purple-300 text-lg' : 'text-purple-400 text-sm'
                }`}>
                  {frisson > 0.7 ? 'INTENSE GOOSEBUMPS!' : 'GOOSEBUMPS BUILDING...'}
                </div>
                {frisson > 0.5 && (
                  <div className="text-xs text-purple-300 mt-1">
                    Neural cascade activated
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* Enhanced start screen */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto px-8"
          >
            <motion.h1 
              className="text-6xl font-bold text-white mb-4"
              animate={{ 
                textShadow: [
                  "0 0 20px rgba(139, 69, 219, 0.5)",
                  "0 0 40px rgba(139, 69, 219, 0.8)",
                  "0 0 20px rgba(139, 69, 219, 0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              QUANTUM FRISSON
            </motion.h1>
            <p className="text-3xl text-purple-400 mb-6">
              ENHANCED GOOSEBUMP GENERATOR
            </p>
            <p className="text-gray-300 mb-6 text-lg leading-relaxed">
              Experience scientifically-tuned audio-visual stimulation designed to trigger 
              frisson response through biometric feedback loops and quantum-entangled frequencies.
            </p>
            <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-4 mb-8 text-left">
              <h3 className="text-purple-300 font-bold mb-2">Enhanced Features:</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Binaural beats at consciousness-altering frequencies</li>
                <li>• Adaptive intensity based on sympathetic nervous response</li>
                <li>• Real-time emotional state visualization</li>
                <li>• Multi-layered audio interference patterns</li>
                <li>• Particle systems triggered by high frisson states</li>
              </ul>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(139, 69, 219, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              onClick={startExperience}
              className="px-12 py-6 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 rounded-full text-white font-bold text-2xl relative overflow-hidden group shadow-lg"
            >
              <span className="relative z-10">ACTIVATE FRISSON FIELD</span>
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.8 }}
                style={{ opacity: 0.2 }}
              />
            </motion.button>
            
            <div className="mt-8 text-sm text-gray-400 space-y-1">
              <p>🎧 Use headphones for optimal binaural beat experience</p>
              <p>🔊 Audio will start automatically - prepare for sensory immersion</p>
              <p>⚡ Adjust intensity if effects are too strong</p>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Enhanced background effect with dynamic intensity */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-500"
        style={{
          background: `radial-gradient(circle at ${centerX}px ${centerY}px, 
            hsla(${260 + frisson * 120}, 100%, ${40 + frisson * 30}%, ${frisson * 0.3}) 0%, 
            hsla(${280 + frisson * 80}, 100%, ${30 + frisson * 20}%, ${frisson * 0.1}) 50%,
            transparent 80%)`,
          filter: `blur(${frisson * 2}px)`,
        }}
      />
      
      {/* Subtle pulse overlay for extreme frisson states */}
      {frisson > 0.8 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ 
            opacity: [0, 0.1, 0],
            scale: [1, 1.02, 1]
          }}
          transition={{ 
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: `radial-gradient(circle, 
              hsla(${280 + frisson * 60}, 100%, 70%, 0.1) 0%, 
              transparent 70%)`
          }}
        />
      )}
    </div>
  );
};

export default QuantumFrissonLaser;