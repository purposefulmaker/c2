"use client"

import React from "react"
import { useRef, useEffect, useMemo } from "react"
import { useAtom } from "jotai"
import { configAtom } from "@/store/sphereAtoms"
import { useSphereGeneration } from "@/hooks/useSphereGeneration"
import { useMouseInteraction } from "@/hooks/useMouseInteraction"
import { useCanvasRenderer } from "@/hooks/useCanvasRenderer"
import type { FractalSphereConfig } from "@/types/sphere"

interface FractalSphereProps extends Partial<FractalSphereConfig> {
  className?: string
  style?: React.CSSProperties
}

const FractalSphere: React.FC<FractalSphereProps> = ({ className = "", style, ...configOverrides }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef<boolean>(false)

  // Atoms
  const [config, setConfig] = useAtom(configAtom)

  // Memoize config overrides to prevent unnecessary re-renders
  const memoizedOverrides = useMemo(
    () => configOverrides,
    [
      configOverrides.radius,
      configOverrides.dotCount,
      configOverrides.dotSize,
      configOverrides.baseColor,
      configOverrides.activeColor,
      configOverrides.proximity,
      configOverrides.shockRadius,
      configOverrides.shockStrength,
      configOverrides.resistance,
      configOverrides.returnDuration,
      configOverrides.rotationSpeed,
    ],
  )

  // Custom hooks
  const { initializeSpheres } = useSphereGeneration()
  const { handleMouseMove, handleMouseDown, handleMouseUp, handleMouseLeave } = useMouseInteraction()
  const { setupCanvas, startRender, stopRender } = useCanvasRenderer()

  // Update config with any props overrides
  useEffect(() => {
    if (Object.keys(memoizedOverrides).length > 0) {
      setConfig((prev) => {
        // Only update if values are actually different
        const needsUpdate = Object.entries(memoizedOverrides).some(
          ([key, value]) => prev[key as keyof FractalSphereConfig] !== value,
        )

        if (needsUpdate) {
          return { ...prev, ...memoizedOverrides }
        }
        return prev
      })
    }
  }, [setConfig, memoizedOverrides])

  // Initialize everything
  useEffect(() => {
    // Prevent double initialization
    if (initializedRef.current) return
    initializedRef.current = true

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    console.log("🔵 Initializing fractal sphere visualization...")

    // Initialize spheres
    initializeSpheres()

    // Setup canvas
    setupCanvas(canvas, container)

    // Start rendering
    startRender(canvas)

    // Set initial cursor
    canvas.style.cursor = "grab"

    // Event handlers with proper cleanup
    const handleResize = () => {
      setupCanvas(canvas, container)
    }

    const handleMouseMoveWrapper = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      handleMouseMove(e, rect)
    }

    const handleMouseDownWrapper = (e: MouseEvent) => {
      handleMouseDown(e)
      canvas.style.cursor = "grabbing"
    }

    const handleMouseUpWrapper = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      handleMouseUp(e, rect)
      canvas.style.cursor = "grab"
    }

    const handleMouseLeaveWrapper = () => {
      handleMouseLeave()
      canvas.style.cursor = "grab"
    }

    // Add event listeners
    window.addEventListener("resize", handleResize)
    canvas.addEventListener("mousemove", handleMouseMoveWrapper)
    canvas.addEventListener("mousedown", handleMouseDownWrapper)
    canvas.addEventListener("mouseup", handleMouseUpWrapper)
    canvas.addEventListener("mouseleave", handleMouseLeaveWrapper)

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
      canvas.removeEventListener("mousemove", handleMouseMoveWrapper)
      canvas.removeEventListener("mousedown", handleMouseDownWrapper)
      canvas.removeEventListener("mouseup", handleMouseUpWrapper)
      canvas.removeEventListener("mouseleave", handleMouseLeaveWrapper)
      stopRender()
    }
  }, [
    initializeSpheres,
    setupCanvas,
    startRender,
    stopRender,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
  ])

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-black ${className}`} style={style}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full select-none" />
    </div>
  )
}

// Use React.memo to prevent unnecessary re-renders
export default React.memo(FractalSphere)
