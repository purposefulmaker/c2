"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { useRef, Suspense } from "react"
import type * as THREE from "three"
import { useBreathRealtime } from "../hooks/useBreathRealtime"

function BreathingSphere() {
  const rmsRef = useBreathRealtime()
  const group = useRef<THREE.Group>(null!)

  // spring params
  const velocity = useRef(0)
  const k = 12 // spring constant – higher = snappier
  const d = 7 // damping – higher = less overshoot
  const baseScale = 1 // neutral
  const maxBoost = 0.5 // adds up to +50 % radius on strong inhale
  const minSquash = 0.8 // down to 80 % radius on exhale

  useFrame((state, dt) => {
    // 0‒1 after simple linear mapping; you could calibrate user‑specific range
    const breath = Math.min(rmsRef.current * 12, 1) // empirical scale
    const target = breath > 0.05 ? baseScale + breath * maxBoost : baseScale - (0.05 - breath) * (baseScale - minSquash)

    // critically damped spring toward target
    const current = group.current.scale.x
    const accel = k * (target - current) - d * velocity.current
    velocity.current += accel * dt
    const next = current + velocity.current * dt

    group.current.scale.set(next, next, next)
  })

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial emissive={"white"} emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

export default function AliveSphere() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 2, 5]} intensity={0.9} />
      <Suspense fallback={null}>
        <BreathingSphere />
      </Suspense>
    </Canvas>
  )
}
