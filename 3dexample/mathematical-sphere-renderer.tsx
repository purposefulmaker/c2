"use client"

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { MathematicalSphereEngine, type BreathData, type SphereTransformation } from '@/lib/mathematical-sphere-engine'

interface MathematicalSphereRendererProps {
  className?: string
  userLocation: { latitude: number; longitude: number; timezone: string }
  onGlyphActivation?: (glyphId: number) => void
  mode: 'learn' | 'create'
}

export default function MathematicalSphereRenderer({
  className = "",
  userLocation,
  onGlyphActivation,
  mode = 'learn'
}: MathematicalSphereRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const engineRef = useRef<MathematicalSphereEngine | null>(null)
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentTransformation, setCurrentTransformation] = useState<SphereTransformation | null>(null)
  const [breathData, setBreathData] = useState<BreathData>({
    intensity: 0,
    coherence: 0,
    phase: 'rest'
  })

  // Initialize the mathematical engine
  useEffect(() => {
    engineRef.current = new MathematicalSphereEngine(
      userLocation.latitude,
      userLocation.longitude,
      userLocation.timezone
    )
    setIsInitialized(true)
    console.log('🔮 Mathematical Sphere Engine initialized')
  }, [userLocation])

  // Render the prismatic sphere with crystal core
  const renderPrismaticSphere = useCallback((
    ctx: CanvasRenderingContext2D,
    transformation: SphereTransformation,
    centerX: number,
    centerY: number
  ) => {
    // Clear with deep space background
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // 1. Render central crystal prism
    renderCrystalPrism(ctx, centerX, centerY, transformation.prismIntensity)

    // 2. Render activated dots with mathematical precision
    renderMathematicalDots(ctx, transformation.dotActivations, centerX, centerY, transformation.scale)

    // 3. Render frequency resonance fields
    renderResonanceFields(ctx, transformation.dotActivations, centerX, centerY)

    // 4. Render light rays from prism to activated dots
    renderPrismaticRays(ctx, transformation.dotActivations, centerX, centerY, transformation.prismIntensity)

  }, [])

  const renderCrystalPrism = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    intensity: number
  ) => {
    const prismSize = 25 * (1 + intensity * 0.5)
    
    // Draw triangular crystal prism
    ctx.save()
    ctx.translate(centerX, centerY)
    
    // Prism faces with rainbow refraction
    const faces = 6
    for (let i = 0; i < faces; i++) {
      const angle = (i * Math.PI * 2) / faces
      const nextAngle = ((i + 1) * Math.PI * 2) / faces
      
      const x1 = Math.cos(angle) * prismSize
      const y1 = Math.sin(angle) * prismSize
      const x2 = Math.cos(nextAngle) * prismSize
      const y2 = Math.sin(nextAngle) * prismSize
      
      // Each face shows different spectrum color
      const hue = (i * 60) % 360
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, prismSize)
      gradient.addColorStop(0, `hsla(${hue}, 100%, 90%, ${intensity})`)
      gradient.addColorStop(0.7, `hsla(${hue}, 80%, 70%, ${intensity * 0.7})`)
      gradient.addColorStop(1, `hsla(${hue}, 60%, 50%, ${intensity * 0.3})`)
      
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()
    }
    
    // Central crystal core
    ctx.beginPath()
    ctx.arc(0, 0, prismSize * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`
    ctx.fill()
    
    ctx.restore()
  }

  const renderMathematicalDots = (
    ctx: CanvasRenderingContext2D,
    activations: any[],
    centerX: number,
    centerY: number,
    sphereScale: number
  ) => {
    const scale = 200 * sphereScale
    
    activations.forEach(activation => {
      const { position, color, intensity, frequency, resonanceField } = activation
      
      // Project 3D to 2D
      const perspective = 800
      const z = position.z * scale + perspective
      const projectedX = (position.x * scale * perspective) / z + centerX
      const projectedY = (position.y * scale * perspective) / z + centerY
      const dotScale = Math.max(0.1, (perspective) / z)
      
      if (intensity > 0.01) {
        // Calculate dot size based on frequency and intensity
        const baseSize = resonanceField ? 2 : 3
        const size = baseSize * dotScale * (0.5 + intensity * 1.5)
        
        // Frequency-based pulsing
        const pulsePhase = (Date.now() * 0.001 * frequency / 432) % (Math.PI * 2)
        const pulse = 1 + Math.sin(pulsePhase) * 0.3 * intensity
        const finalSize = size * pulse
        
        // Create spectrum glow
        const glowRadius = finalSize * 3
        const gradient = ctx.createRadialGradient(
          projectedX, projectedY, 0,
          projectedX, projectedY, glowRadius
        )
        
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`)
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.5})`)
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
        
        // Render glow
        ctx.fillStyle = gradient
        ctx.fillRect(
          projectedX - glowRadius,
          projectedY - glowRadius,
          glowRadius * 2,
          glowRadius * 2
        )
        
        // Render dot core
        ctx.beginPath()
        ctx.arc(projectedX, projectedY, finalSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, intensity + 0.3)})`
        ctx.fill()
        
        // Resonance field indicator
        if (resonanceField && intensity > 0.3) {
          ctx.beginPath()
          ctx.arc(projectedX, projectedY, finalSize * 2, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(138, 43, 226, ${intensity * 0.6})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      } else {
        // Inactive dots - barely visible
        const opacity = resonanceField ? 0.03 : 0.08
        const size = (resonanceField ? 1 : 1.5) * dotScale
        
        ctx.beginPath()
        ctx.arc(projectedX, projectedY, size, 0, Math.PI * 2)
        ctx.fillStyle = resonanceField ? 
          `rgba(138, 43, 226, ${opacity})` : 
          `rgba(255, 215, 0, ${opacity})`
        ctx.fill()
      }
    })
  }

  const renderResonanceFields = (
    ctx: CanvasRenderingContext2D,
    activations: any[],
    centerX: number,
    centerY: number
  ) => {
    // Create interference patterns between activated dots
    const activePoints = activations.filter(a => a.intensity > 0.2)
    
    for (let i = 0; i < activePoints.length; i++) {
      for (let j = i + 1; j < activePoints.length; j++) {
        const point1 = activePoints[i]
        const point2 = activePoints[j]
        
        // Calculate frequency interference
        const freqDiff = Math.abs(point1.frequency - point2.frequency)
        const resonance = 1 / (1 + freqDiff / 100) // Closer frequencies = stronger resonance
        
        if (resonance > 0.5) {
          // Draw resonance connection
          const scale = 200
          const perspective = 800
          
          const z1 = point1.position.z * scale + perspective
          const x1 = (point1.position.x * scale * perspective) / z1 + centerX
          const y1 = (point1.position.y * scale * perspective) / z1 + centerY
          
          const z2 = point2.position.z * scale + perspective
          const x2 = (point2.position.x * scale * perspective) / z2 + centerX
          const y2 = (point2.position.y * scale * perspective) / z2 + centerY
          
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
          const color1 = point1.color
          const color2 = point2.color
          
          gradient.addColorStop(0, `rgba(${color1.r}, ${color1.g}, ${color1.b}, ${resonance * 0.3})`)
          gradient.addColorStop(1, `rgba(${color2.r}, ${color2.g}, ${color2.b}, ${resonance * 0.3})`)
          
          ctx.strokeStyle = gradient
          ctx.lineWidth = resonance * 2
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      }
    }
  }

  const renderPrismaticRays = (
    ctx: CanvasRenderingContext2D,
    activations: any[],
    centerX: number,
    centerY: number,
    prismIntensity: number
  ) => {
    const activePoints = activations.filter(a => a.intensity > 0.1)
    
    activePoints.forEach(point => {
      const scale = 200
      const perspective = 800
      const z = point.position.z * scale + perspective
      const projectedX = (point.position.x * scale * perspective) / z + centerX
      const projectedY = (point.position.y * scale * perspective) / z + centerY
      
      // Create light ray from prism to dot
      const gradient = ctx.createLinearGradient(centerX, centerY, projectedX, projectedY)
      const { r, g, b } = point.color
      const rayIntensity = point.intensity * prismIntensity * 0.4
      
      gradient.addColorStop(0, `rgba(255, 255, 255, ${rayIntensity})`)
      gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${rayIntensity * 0.8})`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${rayIntensity * 0.2})`)
      
      ctx.strokeStyle = gradient
      ctx.lineWidth = rayIntensity * 3
      ctx.globalCompositeOperation = 'lighter' // Additive blending
      
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(projectedX, projectedY)
      ctx.stroke()
    })
    
    ctx.globalCompositeOperation = 'source-over' // Reset blending
  }

  // Animation loop
  useEffect(() => {
    if (!isInitialized || !engineRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
      canvas.style.width = `${container.clientWidth}px`
      canvas.style.height = `${container.clientHeight}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const animate = () => {
      const canvas = canvasRef.current
      if (!canvas || !engineRef.current) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const centerX = canvas.width / (2 * (window.devicePixelRatio || 1))
      const centerY = canvas.height / (2 * (window.devicePixelRatio || 1))

      // Calculate current planetary state
      const now = Date.now()
      const planetaryState = engineRef.current.calculatePlanetaryAlignment(now)

      // Update breath data (this would come from audio processor in real implementation)
      const mockBreathData: BreathData = {
        intensity: 0.3 + Math.sin(now * 0.001) * 0.3,
        coherence: 0.7 + Math.sin(now * 0.0007) * 0.2,
        phase: (['inhale', 'hold', 'exhale', 'rest'] as const)[Math.floor((now / 3000) % 4)],
        frequency: 440 + Math.sin(now * 0.0005) * 50
      }

      setBreathData(mockBreathData)

      // Calculate sphere transformation
      const transformation = engineRef.current.breathToSphereTransform(mockBreathData, planetaryState)
      setCurrentTransformation(transformation)

      // Render the mathematical sphere
      renderPrismaticSphere(ctx, transformation, centerX, centerY)

      // Check for glyph activations (simplified)
      const activeIntensity = transformation.dotActivations.reduce((sum, dot) => sum + dot.intensity, 0)
      if (activeIntensity > 50 && onGlyphActivation) {
        // This would be more sophisticated glyph detection
        const detectedGlyphId = Math.floor(activeIntensity / 10) % 33 + 1
        onGlyphActivation(detectedGlyphId)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [isInitialized, renderPrismaticSphere, onGlyphActivation])

  return (
    <div ref={containerRef} className={`w-full h-full relative ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Mathematical overlay */}
      {currentTransformation && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur rounded-lg p-3 text-white text-xs max-w-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>Prism: {(currentTransformation.prismIntensity * 100).toFixed(0)}%</div>
            <div>Scale: {currentTransformation.scale.toFixed(2)}x</div>
            <div>Active: {currentTransformation.dotActivations.filter(d => d.intensity > 0.01).length}</div>
            <div>Phase: {breathData.phase}</div>
            <div>θ: {currentTransformation.rotation.x.toFixed(1)}°</div>
            <div>φ: {currentTransformation.rotation.y.toFixed(1)}°</div>
            <div>ψ: {currentTransformation.rotation.z.toFixed(1)}°</div>
            <div>Coherence: {(breathData.coherence * 100).toFixed(0)}%</div>
          </div>
        </div>
      )}

      {/* Mode indicator */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur rounded-lg px-3 py-2 text-white text-sm">
        Mode: {mode === 'learn' ? '🎓 Learn First 6' : '🎨 Create Custom'}
      </div>
    </div>
  )
}
