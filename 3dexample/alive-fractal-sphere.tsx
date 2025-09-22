"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { useAtom } from "jotai"
import { audioAtom, breathingAtom } from "@/store/sphereAtoms"

interface AliveFractalSphereProps {
  className?: string
  style?: React.CSSProperties
  onMemoryWarning?: () => void
  breathingMode?: "manual" | "auto" | "microphone"
}

const AliveFractalSphere: React.FC<AliveFractalSphereProps> = ({
  className = "",
  style,
  onMemoryWarning,
  breathingMode = "microphone",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const initializedRef = useRef<boolean>(false)

  const [memoryUsage, setMemoryUsage] = useState(0)
  const [isLowPerformanceMode, setIsLowPerformanceMode] = useState(false)

  // Use shared Jotai state for breathing and audio
  const [breathingState] = useAtom(breathingAtom)
  const [audioState] = useAtom(audioAtom)

  // Mobile detection - stable
  const [isMobile, setIsMobile] = useState(false)

  // STABLE mobile detection - no infinite loops
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
  }, []) // EMPTY dependency array - only run once

  // STABLE sphere state - never changes reference
  const sphereState = useRef({
    dots: [] as any[],
    innerSpheres: [] as any[],
    nerveConnections: [] as any[],
    rotationX: 0,
    rotationY: 0,
    zoomLevel: 1,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    lastTouchDistance: null,
    lastRenderTime: 0,
    dotCount: 0,
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
  }).current

  // STABLE helper functions - no dependencies that change
  const project3DTo2D = useCallback(
    (x: number, y: number, z: number, centerX: number, centerY: number, zoomLevel: number) => {
      const perspective = 800
      const projectedX = centerX + (x * perspective * zoomLevel) / (perspective + z)
      const projectedY = centerY + (y * perspective * zoomLevel) / (perspective + z)
      const scale = Math.max(0.1, (perspective * zoomLevel) / (perspective + z))
      return { projectedX, projectedY, scale }
    },
    [], // EMPTY - this function is pure
  )

  const rotatePoint = useCallback((x: number, y: number, z: number, rotX: number, rotY: number) => {
    // Rotate around Y axis
    const cosY = Math.cos(rotY)
    const sinY = Math.sin(rotY)
    const x1 = x * cosY - z * sinY
    const z1 = x * sinY + z * cosY

    // Rotate around X axis
    const cosX = Math.cos(rotX)
    const sinX = Math.sin(rotX)
    const y1 = y * cosX - z1 * sinX
    const z2 = y * sinX + z1 * cosX

    return { x: x1, y: y1, z: z2 }
  }, []) // EMPTY - this function is pure

  const hexToRgb = useCallback((hex: string) => {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    return match
      ? {
          r: Number.parseInt(match[1], 16),
          g: Number.parseInt(match[2], 16),
          b: Number.parseInt(match[3], 16),
        }
      : { r: 255, g: 255, b: 255 }
  }, []) // EMPTY - this function is pure

  // STABLE initialization - only depends on isMobile
  const initializeSpheres = useCallback(() => {
    if (initializedRef.current) {
      console.log("🔵 Skipping sphere initialization - already initialized")
      return
    }

    const targetDotCount = isMobile ? 200 : 600
    console.log("🔵 Generating fractal sphere with", targetDotCount, "dots for", isMobile ? "mobile" : "desktop")

    // Generate dots using Fibonacci spiral
    const dots = []
    const baseRadius = 180
    const goldenRatio = (1 + Math.sqrt(5)) / 2

    for (let i = 0; i < targetDotCount; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio
      const phi = Math.acos(1 - (2 * i) / targetDotCount)

      const x = baseRadius * Math.sin(phi) * Math.cos(theta)
      const y = baseRadius * Math.sin(phi) * Math.sin(theta)
      const z = baseRadius * Math.cos(phi)

      dots.push({
        x,
        y,
        z,
        projectedX: 0,
        projectedY: 0,
        scale: 1,
        originalX: x,
        originalY: y,
        originalZ: z,
      })
    }

    sphereState.dots = dots
    sphereState.dotCount = targetDotCount

    // Biblical colors for the 12 epochs cross
    const biblicalColors = [
      "#DC143C", // Red - Isaiah 1:18 (scarlet sins)
      "#FFFFFF", // White - Revelation 7:14 (washed robes)
      "#800080", // Purple - Acts 16:14 (Lydia's purple goods)
      "#4169E1", // Blue - Exodus 25:4 (blue yarns)
      "#228B22", // Green - Psalm 23:2 (green pastures)
      "#FFD700", // Gold - Exodus 25:11 (pure gold overlay)
      "#000000", // Black - Isaiah 50:3 (clothe heavens with blackness)
      "#C0C0C0", // Silver - Proverbs 25:11 (setting of silver)
      "#CD7F32", // Bronze - Exodus 27:2 (overlay with bronze)
      "#FF69B4", // Rainbow/Pink - Revelation 4:3 (rainbow around throne)
      "#00CED1", // Rainbow/Turquoise - Additional rainbow color
      "#9370DB", // Rainbow/Medium Slate Blue - Additional rainbow color
    ]

    // Create 12-orb Christian cross arrangement
    const crossSize = isMobile ? 35 : 50
    const orbRadius = isMobile ? 8 : 12

    // Cross formation: 1 center, 3 top, 4 bottom, 2 left, 2 right = 12 total
    const crossArrangements = [
      // Center (1) - White for purity
      { x: 0, y: 0, z: 0, radius: orbRadius * 1.2, color: biblicalColors[1], name: "Center - White" },

      // Top (3) - Gold, Purple, Blue
      { x: 0, y: -crossSize * 0.8, z: 0, radius: orbRadius, color: biblicalColors[5], name: "Top 1 - Gold" },
      { x: 0, y: -crossSize * 0.5, z: 0, radius: orbRadius, color: biblicalColors[2], name: "Top 2 - Purple" },
      { x: 0, y: -crossSize * 0.25, z: 0, radius: orbRadius, color: biblicalColors[3], name: "Top 3 - Blue" },

      // Bottom (4) - Red, Green, Black, Bronze
      { x: 0, y: crossSize * 0.25, z: 0, radius: orbRadius, color: biblicalColors[0], name: "Bottom 1 - Red" },
      { x: 0, y: crossSize * 0.5, z: 0, radius: orbRadius, color: biblicalColors[4], name: "Bottom 2 - Green" },
      { x: 0, y: crossSize * 0.75, z: 0, radius: orbRadius, color: biblicalColors[6], name: "Bottom 3 - Black" },
      { x: 0, y: crossSize * 1.0, z: 0, radius: orbRadius, color: biblicalColors[7], name: "Bottom 4 - Bronze" },

      // Left (2) - Silver, Rainbow Pink
      {
        x: -crossSize * 0.4,
        y: -crossSize * 0.1,
        z: 0,
        radius: orbRadius,
        color: biblicalColors[8],
        name: "Left 1 - Silver",
      },
      {
        x: -crossSize * 0.7,
        y: -crossSize * 0.1,
        z: 0,
        radius: orbRadius,
        color: biblicalColors[9],
        name: "Left 2 - Rainbow Pink",
      },

      // Right (2) - Rainbow Turquoise, Rainbow Purple
      {
        x: crossSize * 0.4,
        y: -crossSize * 0.1,
        z: 0,
        radius: orbRadius,
        color: biblicalColors[10],
        name: "Right 1 - Rainbow Turquoise",
      },
      {
        x: crossSize * 0.7,
        y: -crossSize * 0.1,
        z: 0,
        radius: orbRadius,
        color: biblicalColors[11],
        name: "Right 2 - Rainbow Purple",
      },
    ]

    // Create connections between orbs to form the cross structure
    const nerveConnections = [
      // Vertical connections (center to top and bottom)
      { from: 0, to: 1 }, // Center to top 1
      { from: 0, to: 2 }, // Center to top 2
      { from: 0, to: 3 }, // Center to top 3
      { from: 0, to: 4 }, // Center to bottom 1
      { from: 0, to: 5 }, // Center to bottom 2
      { from: 0, to: 6 }, // Center to bottom 3
      { from: 0, to: 7 }, // Center to bottom 4

      // Horizontal connections (center to left and right)
      { from: 0, to: 8 }, // Center to left 1
      { from: 0, to: 9 }, // Center to left 2
      { from: 0, to: 10 }, // Center to right 1
      { from: 0, to: 11 }, // Center to right 2

      // Sequential connections along arms
      { from: 1, to: 2 }, // Top connections
      { from: 2, to: 3 },
      { from: 4, to: 5 }, // Bottom connections
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 8, to: 9 }, // Left connections
      { from: 10, to: 11 }, // Right connections
    ]

    const innerSpheres = crossArrangements.map((arrangement, i) => ({
      x: arrangement.x,
      y: arrangement.y,
      z: arrangement.z,
      originalX: arrangement.x,
      originalY: arrangement.y,
      originalZ: arrangement.z,
      radius: arrangement.radius,
      color: arrangement.color,
      name: arrangement.name,
      projectedX: 0,
      projectedY: 0,
      scale: 1,
      isCenter: i === 0,
    }))

    sphereState.innerSpheres = innerSpheres
    sphereState.nerveConnections = nerveConnections

    initializedRef.current = true
    console.log("✅ 12-Epoch Cross initialization complete")
  }, [isMobile]) // ONLY depend on isMobile

  // SINGLE SETUP EFFECT - no infinite loops
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    console.log("🔵 Setting up 12-Epoch Cross fractal sphere...")

    // Initialize spheres ONCE
    initializeSpheres()

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

    // DEBOUNCED resize handler
    let resizeTimeout: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resizeCanvas, 100)
    }

    window.addEventListener("resize", debouncedResize)

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      sphereState.isDragging = true
      sphereState.lastMouseX = e.clientX
      sphereState.lastMouseY = e.clientY
      canvas.style.cursor = "grabbing"
    }

    const handleMouseUp = () => {
      sphereState.isDragging = false
      canvas.style.cursor = "grab"
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (sphereState.isDragging) {
        const deltaX = e.clientX - sphereState.lastMouseX
        const deltaY = e.clientY - sphereState.lastMouseY
        sphereState.rotationY += deltaX * 0.01
        sphereState.rotationX += deltaY * 0.01
        sphereState.lastMouseX = e.clientX
        sphereState.lastMouseY = e.clientY
      }
    }

    // Touch event handlers for mobile
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        sphereState.isDragging = true
        sphereState.lastTouchX = touch.clientX
        sphereState.lastTouchY = touch.clientY
      } else if (e.touches.length === 2) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
        )
        sphereState.lastTouchDistance = distance
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (sphereState.isDragging && e.touches.length === 1) {
        const touch = e.touches[0]
        const deltaX = touch.clientX - sphereState.lastTouchX
        const deltaY = touch.clientY - sphereState.lastTouchY
        sphereState.rotationY += deltaX * 0.015
        sphereState.rotationX += deltaY * 0.015
        sphereState.lastTouchX = touch.clientX
        sphereState.lastTouchY = touch.clientY
      } else if (e.touches.length === 2) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
        )
        if (sphereState.lastTouchDistance) {
          const scale = distance / sphereState.lastTouchDistance
          sphereState.zoomLevel *= scale
          sphereState.zoomLevel = Math.max(0.3, Math.min(3, sphereState.zoomLevel))
        }
        sphereState.lastTouchDistance = distance
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      sphereState.isDragging = false
      sphereState.lastTouchDistance = null
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      sphereState.zoomLevel *= delta
      sphereState.zoomLevel = Math.max(0.3, Math.min(3, sphereState.zoomLevel))
    }

    // Add event listeners
    if (!isMobile) {
      canvas.addEventListener("mousedown", handleMouseDown)
      canvas.addEventListener("mouseup", handleMouseUp)
      canvas.addEventListener("mouseleave", handleMouseUp)
      canvas.addEventListener("mousemove", handleMouseMove)
      canvas.addEventListener("wheel", handleWheel)
      canvas.style.cursor = "grab"
    }

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false })
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false })

    // OPTIMIZED animation loop
    let lastFrameTime = 0
    const targetFPS = isMobile ? 15 : 30
    const frameInterval = 1000 / targetFPS

    const animate = (timestamp: number) => {
      // THROTTLE: Skip frames if too frequent
      if (timestamp - lastFrameTime < frameInterval) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      lastFrameTime = timestamp

      const canvas = canvasRef.current
      if (!canvas || !initializedRef.current) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Clear canvas
      ctx.fillStyle = "#0a1428"
      ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))

      // Center coordinates
      const centerX = canvas.width / (2 * (window.devicePixelRatio || 1))
      const centerY = canvas.height / (2 * (window.devicePixelRatio || 1))

      // Auto-rotation
      if (!sphereState.isDragging) {
        sphereState.rotationY += isMobile ? 0.002 : 0.001
      }

      // REAL-TIME BREATH RESPONSE WITH SPRING PHYSICS
      const dt = Math.min(0.032, (timestamp - (sphereState.lastRenderTime || timestamp)) / 1000)
      sphereState.lastRenderTime = timestamp

      // Get current breathing values from global state
      const currentRMS = audioState.volume || 0
      const currentPhase = breathingState.phase || "rest"
      const isBreathing = breathingState.isActive || false

      // Use breathing state values directly for immediate response
      if (isBreathing && breathingState.sphereScale && breathingState.glowIntensity) {
        sphereState.targetScale = breathingState.sphereScale
        sphereState.targetGlow = breathingState.glowIntensity
      } else {
        // Fallback to RMS-based calculation
        const breathIntensity = Math.min(currentRMS * 10, 1)
        sphereState.targetScale =
          1 + breathIntensity * (currentPhase === "inhale" ? 0.4 : currentPhase === "exhale" ? -0.2 : 0)
        sphereState.targetGlow = breathIntensity * 0.8
      }

      // Spring physics for smooth response
      const scaleError = sphereState.targetScale - sphereState.currentScale
      sphereState.scaleVelocity +=
        (sphereState.springK * scaleError - sphereState.dampingD * sphereState.scaleVelocity) * dt
      sphereState.currentScale += sphereState.scaleVelocity * dt

      const glowError = sphereState.targetGlow - sphereState.currentGlow
      sphereState.glowVelocity +=
        (sphereState.springK * glowError - sphereState.dampingD * sphereState.glowVelocity) * dt
      sphereState.currentGlow += sphereState.glowVelocity * dt
      sphereState.currentGlow = Math.max(0, Math.min(1, sphereState.currentGlow))

      // Process inner spheres - Keep cross upright
      const processedInnerSpheres = sphereState.innerSpheres.map((sphere: any) => {
        // Apply breathing scale but NO rotation to keep cross upright
        const x = sphere.originalX * sphereState.currentScale
        const y = sphere.originalY * sphereState.currentScale
        const z = sphere.originalZ * sphereState.currentScale

        const { projectedX, projectedY, scale } = project3DTo2D(x, y, z, centerX, centerY, sphereState.zoomLevel)

        return {
          ...sphere,
          x,
          y,
          z,
          projectedX,
          projectedY,
          scale,
        }
      })

      const sortedInnerSpheres = [...processedInnerSpheres].sort((a, b) => b.z - a.z)

      // Draw cross connections with enhanced glow
      if (!isMobile || sphereState.currentGlow > 0.3) {
        ctx.lineWidth = isMobile ? 2 : 3
        sphereState.nerveConnections.forEach(({ from, to }: { from: number; to: number }) => {
          const fromSphere = processedInnerSpheres[from]
          const toSphere = processedInnerSpheres[to]

          if (!fromSphere || !toSphere) return

          const fromColor = hexToRgb(fromSphere.color)
          const toColor = hexToRgb(toSphere.color)

          const gradient = ctx.createLinearGradient(
            fromSphere.projectedX,
            fromSphere.projectedY,
            toSphere.projectedX,
            toSphere.projectedY,
          )

          // Enhanced connection glow
          const connectionOpacity = 0.7 * sphereState.currentGlow + 0.3
          gradient.addColorStop(0, `rgba(${fromColor.r}, ${fromColor.g}, ${fromColor.b}, ${connectionOpacity})`)
          gradient.addColorStop(1, `rgba(${toColor.r}, ${toColor.g}, ${toColor.b}, ${connectionOpacity})`)

          ctx.strokeStyle = gradient
          ctx.beginPath()
          ctx.moveTo(fromSphere.projectedX, fromSphere.projectedY)
          ctx.lineTo(toSphere.projectedX, toSphere.projectedY)
          ctx.stroke()

          // Add white glow overlay for sacred effect
          if (sphereState.currentGlow > 0.5) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * sphereState.currentGlow})`
            ctx.lineWidth = (isMobile ? 2 : 3) * (1 + sphereState.currentGlow * 0.5)
            ctx.beginPath()
            ctx.moveTo(fromSphere.projectedX, fromSphere.projectedY)
            ctx.lineTo(toSphere.projectedX, toSphere.projectedY)
            ctx.stroke()
          }
        })
      }

      // Render 12-epoch cross orbs with biblical colors
      sortedInnerSpheres.forEach((sphere: any) => {
        const size = sphere.radius * sphere.scale * (isMobile ? 1.2 : 1)
        const rgb = hexToRgb(sphere.color)

        // Enhanced glow for each orb
        const glowSize = size * (2.5 + sphereState.currentGlow * 2)
        const glowGradient = ctx.createRadialGradient(
          sphere.projectedX,
          sphere.projectedY,
          size * 0.2,
          sphere.projectedX,
          sphere.projectedY,
          glowSize,
        )

        // Colored glow based on orb color
        glowGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.8 + sphereState.currentGlow * 0.2})`)
        glowGradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.5 + sphereState.currentGlow * 0.3})`)
        glowGradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.2 + sphereState.currentGlow * 0.2})`)
        glowGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`)

        // Draw colored glow
        ctx.beginPath()
        ctx.arc(sphere.projectedX, sphere.projectedY, glowSize, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()

        // Draw the solid orb with biblical color
        const orbGradient = ctx.createRadialGradient(
          sphere.projectedX,
          sphere.projectedY,
          0,
          sphere.projectedX,
          sphere.projectedY,
          size,
        )

        // Special handling for black orb (make it visible)
        if (sphere.color === "#000000") {
          orbGradient.addColorStop(0, `rgba(64, 64, 64, 0.95)`)
          orbGradient.addColorStop(0.6, `rgba(32, 32, 32, 0.8)`)
          orbGradient.addColorStop(1, `rgba(16, 16, 16, 0.6)`)
        } else {
          orbGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)`)
          orbGradient.addColorStop(
            0.6,
            `rgba(${Math.floor(rgb.r * 0.8)}, ${Math.floor(rgb.g * 0.8)}, ${Math.floor(rgb.b * 0.8)}, 0.8)`,
          )
          orbGradient.addColorStop(
            1,
            `rgba(${Math.floor(rgb.r * 0.6)}, ${Math.floor(rgb.g * 0.6)}, ${Math.floor(rgb.b * 0.6)}, 0.6)`,
          )
        }

        ctx.beginPath()
        ctx.arc(sphere.projectedX, sphere.projectedY, size, 0, Math.PI * 2)
        ctx.fillStyle = orbGradient
        ctx.fill()

        // Add white highlight for center orb (Christ)
        if (sphere.isCenter) {
          const highlightSize = size * 0.4
          const highlightGradient = ctx.createRadialGradient(
            sphere.projectedX - size * 0.2,
            sphere.projectedY - size * 0.2,
            0,
            sphere.projectedX - size * 0.2,
            sphere.projectedY - size * 0.2,
            highlightSize,
          )

          highlightGradient.addColorStop(0, `rgba(255, 255, 255, 0.9)`)
          highlightGradient.addColorStop(1, `rgba(255, 255, 255, 0)`)

          ctx.beginPath()
          ctx.arc(sphere.projectedX, sphere.projectedY, highlightSize, 0, Math.PI * 2)
          ctx.fillStyle = highlightGradient
          ctx.fill()
        }

        // Add breathing pulse effect
        if (sphereState.currentGlow > 0.2) {
          const pulseSize = size * (1 + sphereState.currentGlow * 0.4)
          const pulseGradient = ctx.createRadialGradient(
            sphere.projectedX,
            sphere.projectedY,
            size * 0.8,
            sphere.projectedX,
            sphere.projectedY,
            pulseSize,
          )

          pulseGradient.addColorStop(0, `rgba(255, 255, 255, ${0.3 * sphereState.currentGlow})`)
          pulseGradient.addColorStop(1, `rgba(255, 255, 255, 0)`)

          ctx.beginPath()
          ctx.arc(sphere.projectedX, sphere.projectedY, pulseSize, 0, Math.PI * 2)
          ctx.fillStyle = pulseGradient
          ctx.fill()
        }
      })

      // Update and render FRACTAL DOTS
      sphereState.dots = sphereState.dots.map((dot: any) => {
        const breathingX = dot.originalX * sphereState.currentScale
        const breathingY = dot.originalY * sphereState.currentScale
        const breathingZ = dot.originalZ * sphereState.currentScale

        const rotated = rotatePoint(breathingX, breathingY, breathingZ, sphereState.rotationX, sphereState.rotationY)
        const { projectedX, projectedY, scale } = project3DTo2D(
          rotated.x,
          rotated.y,
          rotated.z,
          centerX,
          centerY,
          sphereState.zoomLevel,
        )

        return {
          ...dot,
          x: rotated.x,
          y: rotated.y,
          z: rotated.z,
          projectedX,
          projectedY,
          scale,
        }
      })

      const sortedDots = [...sphereState.dots].sort((a: any, b: any) => b.z - a.z)

      // Render all dots
      for (let i = 0; i < sortedDots.length; i++) {
        const dot = sortedDots[i]
        if (!dot) continue

        const size = (isMobile ? 3 : 2.5) * dot.scale

        const baseColor = { r: 220, g: 220, b: 255 } // Light base
        let activeColor = { r: 96, g: 165, b: 250 } // Default blue

        if (currentPhase === "inhale") {
          activeColor = { r: 100, g: 225, b: 255 } // Bright cyan for inhale
        } else if (currentPhase === "exhale") {
          activeColor = { r: 180, g: 160, b: 255 } // Lavender for exhale
        }

        // Ensure proper color interpolation
        const colorIntensity = Math.max(0, Math.min(1, sphereState.currentGlow))
        const r = Math.round(baseColor.r + (activeColor.r - baseColor.r) * colorIntensity)
        const g = Math.round(baseColor.g + (activeColor.g - baseColor.g) * colorIntensity)
        const b = Math.round(baseColor.b + (activeColor.b - baseColor.b) * colorIntensity)

        const opacity = Math.min(0.8, Math.max(0.2, (dot.z + 180) / 360))

        ctx.beginPath()
        ctx.arc(dot.projectedX, dot.projectedY, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`
        ctx.fill()
      }

      // Draw breath indicator
      const indicatorWidth = isMobile ? 150 : 200
      const indicatorHeight = isMobile ? 6 : 4
      const indicatorX = canvas.width / (window.devicePixelRatio || 1) - indicatorWidth - (isMobile ? 10 : 20)
      const indicatorY = canvas.height / (window.devicePixelRatio || 1) - (isMobile ? 40 : 30)

      ctx.fillStyle = "rgba(100, 100, 100, 0.3)"
      ctx.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight)

      let indicatorColor = "rgba(255, 255, 255, 0.8)"
      if (currentPhase === "inhale") {
        indicatorColor = "rgba(64, 224, 255, 0.8)"
      } else if (currentPhase === "exhale") {
        indicatorColor = "rgba(147, 112, 219, 0.8)"
      }

      ctx.fillStyle = indicatorColor
      const progress = currentRMS
      ctx.fillRect(indicatorX, indicatorY, indicatorWidth * progress, indicatorHeight)

      // Labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
      ctx.font = isMobile ? "14px Arial" : "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText("Inhale", indicatorX + indicatorWidth * 0.25, indicatorY - 8)
      ctx.fillText("Exhale", indicatorX + indicatorWidth * 0.75, indicatorY - 8)

      // Current phase indicator
      ctx.fillStyle = indicatorColor
      ctx.font = isMobile ? "bold 14px Arial" : "bold 12px Arial"
      ctx.textAlign = "left"

      const statusText = audioState.isInitialized
        ? `🎤 ${currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)} (RMS: ${(currentRMS * 1000).toFixed(1)})`
        : "🎤 Initializing microphone..."

      ctx.fillText(statusText, indicatorX, indicatorY - (isMobile ? 25 : 20))

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener("resize", debouncedResize)
      if (!isMobile) {
        canvas.removeEventListener("mousedown", handleMouseDown)
        canvas.removeEventListener("mouseup", handleMouseUp)
        canvas.removeEventListener("mouseleave", handleMouseUp)
        canvas.removeEventListener("mousemove", handleMouseMove)
        canvas.removeEventListener("wheel", handleWheel)
      }
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("touchend", handleTouchEnd)

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [initializeSpheres]) // ONLY depend on initializeSpheres (which only depends on isMobile)

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-black ${className}`} style={style}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full select-none touch-none" />

      {(isLowPerformanceMode || isMobile) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-900/70 text-white px-4 py-2 rounded-md text-sm">
          {isMobile ? "Mobile Optimized Mode" : "Low Performance Mode Active"}
        </div>
      )}

      {!audioState.isInitialized && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-900/70 text-white px-6 py-3 rounded-md text-center">
          <div className="animate-pulse">🎤 Initializing microphone...</div>
          <div className="text-sm mt-2">Please allow microphone access</div>
        </div>
      )}
    </div>
  )
}

export default React.memo(AliveFractalSphere)
