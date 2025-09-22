"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { useAtom } from "jotai"
import { audioAtom, breathingAtom } from "@/store/sphereAtoms"
import { PLATONIC_SOLIDS, SACRED_PATTERNS, initializeSacredDatabase, findPatternByRotation } from "@/lib/sacred-geometry-database"

interface QuantumCoreSphereProps {
  className?: string
  style?: React.CSSProperties
  breathingMode?: "manual" | "auto" | "microphone"
}

const QuantumCoreSphere: React.FC<QuantumCoreSphereProps> = ({
  className = "",
  style,
  breathingMode = "microphone",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  
  // Use shared Jotai state
  const [breathingState] = useAtom(breathingAtom)
  const [audioState] = useAtom(audioAtom)
  
  // Quantum Core state
  const [activePattern, setActivePattern] = useState<any>(null)
  const [coreGeometry, setCoreGeometry] = useState(PLATONIC_SOLIDS[1]) // Start with Octahedron
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Quantum sphere state with sacred geometry core
  const quantumState = useRef({
    dots: [] as any[],
    coreVertices: [] as any[], // The sacred geometric core
    coreFaces: [] as any[],
    coreRotation: { x: 0, y: 0, z: 0 },
    coreRotationVelocity: { x: 0, y: 0, z: 0 },
    sphereRotation: { x: 0, y: 0 },
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    zoomLevel: 1,
    
    // The FORCE at the center - not light, not dark, but pure rotating energy
    coreForceIntensity: 0,
    coreForcePhase: 0,
    illuminationRays: [] as any[],
    
    // Pattern detection
    currentPattern: null as any,
    patternTransition: 0,
    patternLocked: false,
    
    // Breath responsiveness  
    breathScale: 1,
    breathGlow: 0,
  }).current

  // Initialize quantum sphere with sacred geometry
  const initializeQuantumSphere = useCallback(() => {
    const dotCount = isMobile ? 300 : 600
    console.log('🌌 Initializing Quantum Core Sphere with', dotCount, 'fractal dots')
    
    // Initialize sacred pattern database
    initializeSacredDatabase(dotCount)
    
    // Generate sphere dots using Fibonacci spiral (same as other spheres)
    const dots = []
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    
    for (let i = 0; i < dotCount; i++) {
      const y = 1 - (i / (dotCount - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i
      
      const x = Math.cos(theta) * radius * 180
      const y3d = y * 180
      const z = Math.sin(theta) * radius * 180
      
      dots.push({
        x, y: y3d, z,
        originalX: x, originalY: y3d, originalZ: z,
        projectedX: 0, projectedY: 0,
        scale: 1,
        illuminated: false,
        illuminationIntensity: 0,
        illuminationColor: { r: 255, g: 255, b: 255 },
        index: i
      })
    }
    
    quantumState.dots = dots
    
    // Initialize core geometry (start with Octahedron)
    const coreVertices = coreGeometry.vertices.map(vertex => ({
      x: vertex[0] * 30, // Scale for visibility
      y: vertex[1] * 30,
      z: vertex[2] * 30,
      originalX: vertex[0] * 30,
      originalY: vertex[1] * 30, 
      originalZ: vertex[2] * 30,
      projectedX: 0,
      projectedY: 0,
      scale: 1
    }))
    
    quantumState.coreVertices = coreVertices
    quantumState.coreFaces = coreGeometry.faces
    
    console.log(`🔮 Quantum core initialized with ${coreGeometry.name}`)
    console.log(`✨ Sacred patterns loaded: ${SACRED_PATTERNS.length}`)
  }, [coreGeometry, isMobile])

  // Helper functions
  const project3DTo2D = useCallback(
    (x: number, y: number, z: number, centerX: number, centerY: number, zoomLevel: number) => {
      const perspective = 800
      const projectedX = centerX + (x * perspective * zoomLevel) / (perspective + z)
      const projectedY = centerY + (y * perspective * zoomLevel) / (perspective + z)
      const scale = Math.max(0.1, (perspective * zoomLevel) / (perspective + z))
      return { projectedX, projectedY, scale }
    },
    [],
  )

  const rotatePoint = useCallback((x: number, y: number, z: number, rotX: number, rotY: number, rotZ: number = 0) => {
    // Rotate around Y axis
    let cosY = Math.cos(rotY), sinY = Math.sin(rotY)
    let x1 = x * cosY - z * sinY
    let z1 = x * sinY + z * cosY

    // Rotate around X axis
    let cosX = Math.cos(rotX), sinX = Math.sin(rotX)
    let y1 = y * cosX - z1 * sinX
    let z2 = y * sinX + z1 * cosX

    // Rotate around Z axis
    let cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ)
    let x2 = x1 * cosZ - y1 * sinZ
    let y2 = x1 * sinZ + y1 * cosZ

    return { x: x2, y: y2, z: z2 }
  }, [])

  // THE CORE FORCE - Render the sacred geometric core
  const renderQuantumCore = useCallback((ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => {
    // Update core rotation based on breath and force
    const breathIntensity = Math.max(breathingState.intensity || 0, 0.1)
    const currentPhase = breathingState.phase || 'rest'
    
    // The FORCE rotates constantly - this is the source of all illumination
    quantumState.coreForcePhase += 0.03
    quantumState.coreForceIntensity = breathIntensity
    
    // Breath affects core rotation speed and direction
    switch (currentPhase) {
      case 'inhale':
        quantumState.coreRotationVelocity.x += 0.002
        quantumState.coreRotationVelocity.y += 0.003
        break
      case 'exhale':
        quantumState.coreRotationVelocity.x -= 0.001
        quantumState.coreRotationVelocity.z += 0.004
        break
      case 'hold':
        // Momentary stillness, then acceleration
        quantumState.coreRotationVelocity.y += 0.005
        break
    }
    
    // Apply momentum with dampening
    quantumState.coreRotation.x += quantumState.coreRotationVelocity.x
    quantumState.coreRotation.y += quantumState.coreRotationVelocity.y
    quantumState.coreRotation.z += quantumState.coreRotationVelocity.z
    
    // Natural dampening
    quantumState.coreRotationVelocity.x *= 0.995
    quantumState.coreRotationVelocity.y *= 0.995
    quantumState.coreRotationVelocity.z *= 0.995
    
    // Minimum rotation to keep the force alive
    quantumState.coreRotation.y += 0.01
    
    // Update core vertices positions
    quantumState.coreVertices.forEach(vertex => {
      const rotated = rotatePoint(
        vertex.originalX * quantumState.breathScale,
        vertex.originalY * quantumState.breathScale,
        vertex.originalZ * quantumState.breathScale,
        quantumState.coreRotation.x,
        quantumState.coreRotation.y,
        quantumState.coreRotation.z
      )
      
      vertex.x = rotated.x
      vertex.y = rotated.y  
      vertex.z = rotated.z
      
      const projection = project3DTo2D(vertex.x, vertex.y, vertex.z, centerX, centerY, quantumState.zoomLevel)
      vertex.projectedX = projection.projectedX
      vertex.projectedY = projection.projectedY
      vertex.scale = projection.scale
    })
    
    // Render the sacred geometric core
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 + quantumState.coreForceIntensity * 0.3})`
    ctx.lineWidth = 2
    
    // Draw edges of the geometric solid
    quantumState.coreFaces.forEach(face => {
      ctx.beginPath()
      
      face.forEach((vertexIndex, i) => {
        const vertex = quantumState.coreVertices[vertexIndex]
        if (vertex) {
          if (i === 0) {
            ctx.moveTo(vertex.projectedX, vertex.projectedY)
          } else {
            ctx.lineTo(vertex.projectedX, vertex.projectedY)
          }
        }
      })
      
      ctx.closePath()
      ctx.stroke()
      
      // Fill faces with pulsing energy
      if (quantumState.coreForceIntensity > 0.3) {
        const pulseIntensity = 0.1 + Math.sin(quantumState.coreForcePhase) * 0.1 * quantumState.coreForceIntensity
        ctx.fillStyle = `rgba(150, 150, 255, ${pulseIntensity})`
        ctx.fill()
      }
    })
    
    // Central force emanation point
    const forceRadius = 8 * (1 + quantumState.coreForceIntensity * 0.5)
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, forceRadius)
    
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 + quantumState.coreForceIntensity * 0.1})`)
    gradient.addColorStop(0.5, `rgba(200, 200, 255, ${0.6 * quantumState.coreForceIntensity})`)
    gradient.addColorStop(1, `rgba(150, 150, 255, 0)`)
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, forceRadius, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()
    
    // Check for sacred pattern alignment
    const currentPattern = findPatternByRotation(
      quantumState.coreRotation.x * 180 / Math.PI,
      quantumState.coreRotation.y * 180 / Math.PI,
      quantumState.coreRotation.z * 180 / Math.PI
    )
    
    if (currentPattern && currentPattern !== quantumState.currentPattern) {
      quantumState.currentPattern = currentPattern
      setActivePattern(currentPattern)
      console.log('🔮 Sacred pattern aligned:', currentPattern.name)
    }
    
  }, [breathingState, project3DTo2D, rotatePoint])

  // Illuminate fractal dots based on sacred patterns
  const illuminateSacredDots = useCallback(() => {
    // Reset all dots
    quantumState.dots.forEach(dot => {
      dot.illuminated = false
      dot.illuminationIntensity = 0
    })
    
    // If we have an active pattern, illuminate those specific dots
    if (quantumState.currentPattern && quantumState.coreForceIntensity > 0.2) {
      const pattern = quantumState.currentPattern
      
      pattern.dotPattern.forEach(dotIndex => {
        if (dotIndex < quantumState.dots.length) {
          const dot = quantumState.dots[dotIndex]
          dot.illuminated = true
          dot.illuminationIntensity = quantumState.coreForceIntensity
          
          // Color based on pattern tradition
          if (pattern.tradition === 'Hindu/Vedic') {
            dot.illuminationColor = { r: 255, g: 165, b: 0 } // Orange
          } else if (pattern.tradition === 'Hebrew/Egyptian') {
            dot.illuminationColor = { r: 255, g: 215, b: 0 } // Gold
          } else if (pattern.tradition === 'Christian/Universal') {
            dot.illuminationColor = { r: 255, g: 255, b: 255 } // White
          } else if (pattern.tradition === 'Tibetan Buddhist') {
            dot.illuminationColor = { r: 255, g: 0, b: 0 } // Red
          } else {
            dot.illuminationColor = { r: 150, g: 150, b: 255 } // Light blue
          }
        }
      })
    } else {
      // Subtle base illumination from core force
      quantumState.dots.forEach((dot, i) => {
        const distance = Math.sqrt(dot.x*dot.x + dot.y*dot.y + dot.z*dot.z)
        const forceReach = 1 - (distance / 250)
        
        if (forceReach > 0) {
          dot.illuminationIntensity = forceReach * quantumState.coreForceIntensity * 0.3
          dot.illuminationColor = { r: 200, g: 200, b: 255 }
        }
      })
    }
  }, [])

  // Setup canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    initializeQuantumSphere()

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
      canvas.style.width = `${container.clientWidth}px`
      canvas.style.height = `${container.clientHeight}px`

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Mouse/touch interactions
    const handleMouseDown = (e: MouseEvent) => {
      quantumState.isDragging = true
      quantumState.lastMouseX = e.clientX
      quantumState.lastMouseY = e.clientY
      canvas.style.cursor = "grabbing"
    }

    const handleMouseUp = () => {
      quantumState.isDragging = false
      canvas.style.cursor = "grab"
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (quantumState.isDragging) {
        const deltaX = e.clientX - quantumState.lastMouseX
        const deltaY = e.clientY - quantumState.lastMouseY
        quantumState.sphereRotation.y += deltaX * 0.01
        quantumState.sphereRotation.x += deltaY * 0.01
        quantumState.lastMouseX = e.clientX
        quantumState.lastMouseY = e.clientY
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      quantumState.zoomLevel *= delta
      quantumState.zoomLevel = Math.max(0.3, Math.min(3, quantumState.zoomLevel))
    }

    if (!isMobile) {
      canvas.addEventListener("mousedown", handleMouseDown)
      canvas.addEventListener("mouseup", handleMouseUp)
      canvas.addEventListener("mouseleave", handleMouseUp)
      canvas.addEventListener("mousemove", handleMouseMove)
      canvas.addEventListener("wheel", handleWheel)
      canvas.style.cursor = "grab"
    }

    // Animation loop
    let lastFrameTime = 0
    const targetFPS = isMobile ? 20 : 30

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTime < 1000 / targetFPS) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = timestamp

      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Clear with deep space background
      ctx.fillStyle = "#000a14"
      ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))

      const centerX = canvas.width / (2 * (window.devicePixelRatio || 1))
      const centerY = canvas.height / (2 * (window.devicePixelRatio || 1))

      // Update breath responsiveness
      const currentRMS = audioState.volume
      const currentPhase = breathingState.phase || "rest"
      const breath = Math.min(currentRMS * 10, 1)
      
      quantumState.breathScale = 1 + breath * 0.2
      quantumState.breathGlow = breath
      quantumState.coreForceIntensity = Math.max(breath, audioState.isInitialized ? 0.3 : 0.1)

      // Auto rotation when not dragging
      if (!quantumState.isDragging) {
        quantumState.sphereRotation.y += 0.003
      }

      // Update dot positions
      quantumState.dots.forEach(dot => {
        const rotated = rotatePoint(
          dot.originalX * quantumState.breathScale,
          dot.originalY * quantumState.breathScale,
          dot.originalZ * quantumState.breathScale,
          quantumState.sphereRotation.x,
          quantumState.sphereRotation.y
        )
        
        dot.x = rotated.x
        dot.y = rotated.y
        dot.z = rotated.z
        
        const projection = project3DTo2D(dot.x, dot.y, dot.z, centerX, centerY, quantumState.zoomLevel)
        dot.projectedX = projection.projectedX
        dot.projectedY = projection.projectedY
        dot.scale = projection.scale
      })

      // Illuminate dots based on sacred patterns
      illuminateSacredDots()

      // Render dots with sacred illumination
      const sortedDots = [...quantumState.dots].sort((a, b) => b.z - a.z)
      sortedDots.forEach(dot => {
        const baseSize = (isMobile ? 2.5 : 2) * dot.scale
        const illuminatedSize = baseSize * (1 + dot.illuminationIntensity)
        
        // Base dot
        ctx.beginPath()
        ctx.arc(dot.projectedX, dot.projectedY, baseSize, 0, Math.PI * 2)
        
        const baseOpacity = Math.max(0.1, (dot.z + 180) / 360)
        ctx.fillStyle = `rgba(100, 100, 150, ${baseOpacity})`
        ctx.fill()
        
        // Sacred illumination
        if (dot.illuminationIntensity > 0.1) {
          const color = dot.illuminationColor
          const intensity = dot.illuminationIntensity
          
          // Illuminated dot
          ctx.beginPath()
          ctx.arc(dot.projectedX, dot.projectedY, illuminatedSize, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.9})`
          ctx.fill()
          
          // Glow effect
          if (intensity > 0.5) {
            const glowRadius = illuminatedSize * 2
            const glowGradient = ctx.createRadialGradient(
              dot.projectedX, dot.projectedY, illuminatedSize,
              dot.projectedX, dot.projectedY, glowRadius
            )
            glowGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.3})`)
            glowGradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
            
            ctx.beginPath()
            ctx.arc(dot.projectedX, dot.projectedY, glowRadius, 0, Math.PI * 2)
            ctx.fillStyle = glowGradient
            ctx.fill()
          }
        }
      })

      // Render the quantum core
      renderQuantumCore(ctx, centerX, centerY)

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", resizeCanvas)
      if (!isMobile) {
        canvas.removeEventListener("mousedown", handleMouseDown)
        canvas.removeEventListener("mouseup", handleMouseUp)
        canvas.removeEventListener("mouseleave", handleMouseUp)
        canvas.removeEventListener("mousemove", handleMouseMove)
        canvas.removeEventListener("wheel", handleWheel)
      }
    }
  }, [
    initializeQuantumSphere,
    project3DTo2D,
    rotatePoint,
    renderQuantumCore,
    illuminateSacredDots,
    audioState,
    breathingState,
    isMobile,
  ])

  return (
    <div ref={containerRef} className={`w-full h-full relative ${className}`} style={style}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Pattern Information Overlay */}
      {activePattern && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-lg rounded-lg p-3 text-white max-w-xs">
          <h3 className="font-bold text-sm mb-1">🔮 {activePattern.name}</h3>
          <p className="text-xs text-gray-300 mb-1">{activePattern.tradition}</p>
          <p className="text-xs text-blue-300">{activePattern.resonanceFrequency}Hz</p>
          <p className="text-xs mt-1">{activePattern.description}</p>
        </div>
      )}
      
      {/* Core Geometry Selector */}
      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-lg rounded-lg p-3">
        <div className="text-white text-xs mb-2">Sacred Core:</div>
        <select 
          value={coreGeometry.name}
          onChange={(e) => {
            const newGeometry = PLATONIC_SOLIDS.find(g => g.name === e.target.value)
            if (newGeometry) setCoreGeometry(newGeometry)
          }}
          className="bg-black/50 text-white text-xs p-1 rounded"
        >
          {PLATONIC_SOLIDS.map(geometry => (
            <option key={geometry.name} value={geometry.name}>
              {geometry.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-gray-400 mt-1">
          {coreGeometry.characteristics}
        </div>
      </div>
    </div>
  )
}

export default QuantumCoreSphere
