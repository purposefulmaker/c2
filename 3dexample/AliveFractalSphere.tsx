"use client"

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAtom } from 'jotai'
import { audioAtom, breathingAtom } from '@/store/sphereAtoms'
import useSacredPatterns from '@/hooks/useSacredPatterns'
import { glyphs, getGlyphForPosition, getGlyphIntensity } from '@/lib/glyphs'

interface AliveFractalSphereProps {
  className?: string
  style?: React.CSSProperties
  onMemoryWarning?: () => void
  breathingMode?: "manual" | "auto" | "microphone"
  visualizationOverride?: {
    activeDots?: number[]
    glyphOverlay?: {
      glyphId: number
      intensity: number
      dots: number[]
      color: string
    }
    patternIntensity?: number
    lambdaPsiPhase?: number
  }
  userLocation: { 
    latitude: number
    longitude: number
    timezone: string 
  }
  audioDriven?: boolean
}

  // useEffect(() => {
  //   // ...canvas setup

  //   const animate = (timestamp: number) => {
  //     // ...other animation logic

  //     // Modulate scale by energy (e.g., between 1 and 1.5)
  //     sphereState.currentScale = 1 + energy * 0.5

  //     // Example: pass energy to rendering functions for opacity
  //     // renderIlluminatedFractalDots(ctx, projectedDots, sphereState, energy)

  //     animationRef.current = requestAnimationFrame(animate)
  //   }

  //   animationRef.current = requestAnimationFrame(animate)

  //   // ...cleanup
  // }, [energy /* plus other deps */])

export default function AliveFractalSphere({
  className = "",
  style,
  onMemoryWarning,
  breathingMode = "microphone",
  visualizationOverride,
  userLocation,
  audioDriven,
  energy = 0, // <-- Add energy prop with default
}: AliveFractalSphereProps & { energy?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glyphCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [isLowPerformanceMode, setIsLowPerformanceMode] = useState(false)

  // Use shared Jotai state for breathing and audio
  const [breathingState] = useAtom(breathingAtom)
  const [audioState] = useAtom(audioAtom)

  // Add sacred pattern integration
  const { activePattern, currentRotation } = useSacredPatterns()

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile =
        window.innerWidth < 1024 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(mobile)
      if (mobile) {
        setIsLowPerformanceMode(true)
      }
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Enhanced sphere state with prismatic light system
  const sphereState = useRef({
    dots: [] as any[],
    innerSpheres: [] as any[],
    resonanceConnections: [] as any[],
    nerveConnections: [] as any[],
    lightRays: [] as any[],
    rotationX: 0,
    rotationY: 0,
    rotationMomentum: 0,
    angularVelocity: 0,
    zoomLevel: 1,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    lastTouchDistance: null as number | null,
    lastRenderTime: 0,
    dotCount: isMobile ? 200 : 600,
    // Prismatic light system
    prismRotation: 0,
    spectrumPhase: 0,
    lightIntensity: 0,
    glyphFormation: 0,
    // Pattern proximity (how close to sacred pattern)
    patternProximity: 0,
    patternPulse: 0, 
    reactionStrength: 0,
    // Real-time breath response with spring physics
    currentScale: 1,
    targetScale: 1,
    scaleVelocity: 0,
    currentGlow: 0,
    targetGlow: 0,
    glowVelocity: 0,
    // Spring constants
    springK: 15,
    dampingD: 8,
    // Glyph system
    glyphAnchors: [] as any[],
  }).current

  // ... all other code remains unchanged ...

  useEffect(() => {
    // ...canvas setup

    const animate = (timestamp: number) => {
      // ...other animation logic

      // Modulate scale by energy (e.g., between 1 and 1.5)
      sphereState.currentScale = 1 + energy * 0.5

      // Example: pass energy to rendering functions for opacity
      // renderIlluminatedFractalDots(ctx, projectedDots, sphereState, energy)

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    // ...cleanup
  }, [energy /* plus other deps */])

  // ...rest of the component unchanged...
  return (
    <div ref={containerRef} className={`w-full h-full ${className}`} style={style}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <canvas 
        ref={glyphCanvasRef} 
        className="absolute inset-0 pointer-events-none block w-full h-full" 
      />
    </div>
  )
}
