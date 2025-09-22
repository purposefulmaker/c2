// components/quantum-sphere.tsx
"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useMemo, useRef, useEffect } from "react"
import { create } from "zustand"
import { GLYPHS } from "./glyphs" // Assuming this path and GLYPHS structure is correct

// Module-level wavelengthToColor function
function wavelengthToColor(nm: number): THREE.Color {
  let color: THREE.Color
  if (nm < 380.0) {
    color = new THREE.Color(0.5, 0.0, 1.0)
  } // Simplified UV
  else if (nm < 440.0) {
    color = new THREE.Color(0.5, 0.0, 1.0).lerp(new THREE.Color(0.0, 0.0, 1.0), (nm - 380.0) / 60.0)
  } else if (nm < 490.0) {
    color = new THREE.Color(0.0, 0.0, 1.0).lerp(new THREE.Color(0.0, 1.0, 1.0), (nm - 440.0) / 50.0)
  } else if (nm < 510.0) {
    color = new THREE.Color(0.0, 1.0, 1.0).lerp(new THREE.Color(0.0, 1.0, 0.0), (nm - 490.0) / 20.0)
  } else if (nm < 580.0) {
    color = new THREE.Color(0.0, 1.0, 0.0).lerp(new THREE.Color(1.0, 1.0, 0.0), (nm - 510.0) / 70.0)
  } else if (nm < 645.0) {
    color = new THREE.Color(1.0, 1.0, 0.0).lerp(new THREE.Color(1.0, 0.0, 0.0), (nm - 580.0) / 65.0)
  } else if (nm <= 700.0) {
    color = new THREE.Color(1.0, 0.0, 0.0)
  } else {
    color = new THREE.Color(0.8, 0.0, 0.0)
  } // Simplified IR
  return color
}

/* ---------- GLOBAL STATE (Zustand) ------------------ */
interface QuantumSphereState {
  glyphKey: string
  wavelength: number
  intensity: number
  spinRate: number
  beams: boolean
  edges: boolean
  strobe: boolean
  strobeFlashesPerRevolution: number
  strobeFlashDuration: number
  recursionIndex: number
  glitchIntensity: number
  hologramStrength: number
  scanlineSpeed: number
  fresnelPower: number
}

export const useQuantumSphereStore = create<QuantumSphereState>((set) => ({
  glyphKey: "therefore",
  wavelength: 550, // nm
  intensity: 1.0,
  spinRate: 0,
  beams: true,
  edges: true,
  strobe: false,
  strobeFlashesPerRevolution: 4,
  strobeFlashDuration: 0.1,
  recursionIndex: 0.0,
  glitchIntensity: 0.0,
  hologramStrength: 1.0,
  scanlineSpeed: 2.0,
  fresnelPower: 2.0,
}))

// Pre-calculate static data
const spherePositions = new Float32Array(
  Array.from({ length: 1000 }, (_, i) => {
    const phi = Math.PI * (3 - Math.sqrt(5))
    const y = 1 - (i / 999) * 2
    const radius = Math.sqrt(1 - y * y)
    const theta = phi * i
    return [Math.cos(theta) * radius * 3, y * 3, Math.sin(theta) * radius * 3]
  }).flat(),
)
const sphereNodeIndices = new Float32Array(Array.from({ length: 1000 }, (_, i) => i))
const spherePoints = Array.from({ length: 1000 }, (_, i) => {
  return new THREE.Vector3(spherePositions[i * 3], spherePositions[i * 3 + 1], spherePositions[i * 3 + 2])
})

/* ---------- POINT CLOUD ----------------------------- */
function NodeCloud() {
  const {
    glyphKey,
    wavelength,
    intensity,
    spinRate,
    recursionIndex,
    glitchIntensity,
    hologramStrength,
    scanlineSpeed,
    fresnelPower,
  } = useQuantumSphereStore()
  const activeNodes = useMemo(() => new Float32Array(1000).fill(0), [])

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0.0 },
          wavelength: { value: 550.0 },
          recursionIndex: { value: 0.0 },
          hologramStrength: { value: 1.0 },
          scanlineSpeed: { value: 2.0 },
          fresnelPower: { value: 2.0 },
          glitchIntensity: { value: 0.0 },
          uIntensity: { value: 1.0 },
          uActive: { value: activeNodes },
          uPrism: { value: new THREE.Vector3(0, 0, 0) },
          uSpinRate: { value: 0.0 },
          uMinSpin: { value: 0.0 },
          uStrobeActive: { value: false },
          uFlashesPerRevolution: { value: 4.0 },
          uFlashDuration: { value: 0.1 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;
            varying vec2 vUv;
            
            uniform float time;
            uniform float recursionIndex; 
            uniform float uActive[1000]; 
            attribute float nodeIndex; 

            vec3 holographicDisplacement(vec3 pos, vec3 normal_in) {
              float phase = time * 2.0 + pos.y * 10.0;
              vec3 displacement = vec3(0.0);
              float active_node = uActive[int(nodeIndex)];
              float quantum = sin(phase + recursionIndex * 3.14159) * 0.02 * active_node;
              displacement += normal_in * quantum * (1.0 - recursionIndex);
              float interference = sin(pos.x * 50.0) * sin(pos.z * 50.0) * 0.01 * active_node;
              displacement += normal_in * interference;
              return displacement;
            }
            
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vUv = uv;
              vec3 displaced = position + holographicDisplacement(position, normal);
              vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
              vViewPosition = -mvPosition.xyz;
              vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
              gl_Position = projectionMatrix * mvPosition;
              float pointSizeBase = uActive[int(nodeIndex)] > 0.5 ? 10.0 : 3.0;
              gl_PointSize = pointSizeBase * (1.0 + recursionIndex * 0.5);
            }
          `,
        fragmentShader: `
            uniform float time;
            uniform float wavelength; 
            uniform float recursionIndex;
            uniform float hologramStrength;
            uniform float scanlineSpeed;
            uniform float fresnelPower;
            uniform float glitchIntensity;
            
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;
            varying vec2 vUv;
            
            // Renamed to avoid any conflict with JS function
            vec3 wavelengthToRGB_frag(float nm) {
              vec3 color;
              if (nm < 380.0) { color = vec3(0.5, 0.0, 1.0); } 
              else if (nm < 440.0) { color = mix(vec3(0.5, 0.0, 1.0), vec3(0.0, 0.0, 1.0), (nm - 380.0) / 60.0); }
              else if (nm < 490.0) { color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (nm - 440.0) / 50.0); }
              else if (nm < 510.0) { color = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (nm - 490.0) / 20.0); }
              else if (nm < 580.0) { color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (nm - 510.0) / 70.0); }
              else if (nm < 645.0) { color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (nm - 580.0) / 65.0); }
              else if (nm <= 700.0) { color = vec3(1.0, 0.0, 0.0); }
              else { color = vec3(0.8, 0.0, 0.0); } 
              return color;
            }
            
            void main() {
              vec2 c = gl_PointCoord - vec2(0.5); 
              float d = length(c);
              if (d > 0.5) discard;

              vec3 viewDir = normalize(vViewPosition);
              vec3 normal_frag = normalize(vNormal); 
              vec3 baseColor = wavelengthToRGB_frag(wavelength);
              float fresnel = 1.0 - dot(normal_frag, viewDir);
              fresnel = pow(fresnel, fresnelPower);
              float scanline_effect = sin((vUv.y + time * scanlineSpeed) * 100.0) * 0.5 + 0.5;
              float shimmer = sin(time * 10.0 + vWorldPosition.y * 20.0) * 0.5 + 0.5;
              vec3 color = baseColor * (1.0 + fresnel * 3.0);
              color *= scanline_effect;
              color += baseColor * shimmer * 0.3;
              
              if (glitchIntensity > 0.0) {
                float glitch = step(0.98, sin(time * 50.0 + vUv.y * 20.0)) * glitchIntensity;
                color.r += glitch * 0.3;
                color.g -= glitch * 0.2;
                color.b += glitch * 0.5;
              }
              
              if (recursionIndex > 0.1) {
                float pulse = sin(time * 5.0) * 0.5 + 0.5;
                color = mix(color, vec3(1.0, 0.0, 0.0), recursionIndex * pulse);
              }
              
              float alpha = (0.8 + fresnel * 0.2) * (1.0 - d * 2.0); 
              alpha *= hologramStrength;
              
              gl_FragColor = vec4(color, alpha);
            }
          `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [activeNodes],
  )

  useFrame((state, delta) => {
    shaderMaterial.uniforms.time.value += delta
    shaderMaterial.uniforms.wavelength.value = wavelength
    shaderMaterial.uniforms.recursionIndex.value = recursionIndex
    shaderMaterial.uniforms.glitchIntensity.value = glitchIntensity
    shaderMaterial.uniforms.hologramStrength.value = hologramStrength
    shaderMaterial.uniforms.scanlineSpeed.value = scanlineSpeed
    shaderMaterial.uniforms.fresnelPower.value = fresnelPower
    shaderMaterial.uniforms.uIntensity.value = intensity
    shaderMaterial.uniforms.uSpinRate.value = spinRate

    // Update strobe uniforms from store if they are intended to be dynamic
    // For now, they are initialized in uniforms object and not updated per frame from store
    // as the new shader doesn't directly use strobe, strobeFlashesPerRevolution, strobeFlashDuration
    // from the store. The uStrobeActive, uFlashesPerRevolution, uFlashDuration uniforms are there
    // if parts of the old vertex shader logic that used them are still active.
    // If dynamic control is needed:
    // const storeState = useQuantumSphereStore.getState();
    // shaderMaterial.uniforms.uStrobeActive.value = storeState.strobe;
    // shaderMaterial.uniforms.uFlashesPerRevolution.value = storeState.strobeFlashesPerRevolution;
    // shaderMaterial.uniforms.uFlashDuration.value = storeState.strobeFlashDuration;

    activeNodes.fill(0)
    const currentGlyph = GLYPHS[glyphKey]
    if (currentGlyph?.nodes) {
      currentGlyph.nodes.forEach((nodeIdx) => {
        if (nodeIdx >= 0 && nodeIdx < 1000) activeNodes[nodeIdx] = 1.0
      })
      if (shaderMaterial.uniforms.uMinSpin) {
        shaderMaterial.uniforms.uMinSpin.value = currentGlyph.minSpin || 0.0
      }
    }
    if (shaderMaterial.uniforms.uActive) {
      shaderMaterial.uniforms.uActive.needsUpdate = true
    }
  })

  return (
    <points material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={spherePositions.length / 3}
          array={spherePositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-nodeIndex"
          count={sphereNodeIndices.length}
          array={sphereNodeIndices}
          itemSize={1}
        />
      </bufferGeometry>
    </points>
  )
}

/* ---------- PRISM, BEAMS, & EDGES ------------------- */
function Prism() {
  return (
    <mesh>
      <octahedronGeometry args={[0.3, 1]} />
      <meshBasicMaterial color={0xffffff} transparent opacity={0.9} />
    </mesh>
  )
}

function Beams() {
  const lineRef = useRef<THREE.LineSegments>(null)
  const attributeRef = useRef<THREE.BufferAttribute>(null)
  const { glyphKey, wavelength, intensity, beams } = useQuantumSphereStore()

  useEffect(() => {
    if (!lineRef.current || !attributeRef.current) return

    const positions = attributeRef.current.array as Float32Array
    const currentGlyph = GLYPHS[glyphKey]
    let lineCount = 0

    if (beams && currentGlyph?.nodes) {
      lineCount = currentGlyph.nodes.length
      currentGlyph.nodes.forEach((nodeIndex, i) => {
        if (nodeIndex < 0 || nodeIndex >= spherePoints.length) return // Bounds check
        const targetPos = spherePoints[nodeIndex]
        const baseIndex = i * 6
        if (baseIndex + 5 < positions.length) {
          // Ensure we don't write out of bounds
          positions[baseIndex + 0] = 0
          positions[baseIndex + 1] = 0
          positions[baseIndex + 2] = 0
          positions[baseIndex + 3] = targetPos.x
          positions[baseIndex + 4] = targetPos.y
          positions[baseIndex + 5] = targetPos.z
        }
      })
    }

    attributeRef.current.needsUpdate = true
    lineRef.current.geometry.setDrawRange(0, lineCount * 2) // Each line has 2 vertices

    const material = lineRef.current.material as THREE.LineBasicMaterial
    material.color = wavelengthToColor(wavelength)
    material.opacity = 0.6 * intensity
  }, [glyphKey, beams, wavelength, intensity])

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          ref={attributeRef}
          attach="attributes-position"
          count={1000} // Max number of lines (1000 lines = 2000 vertices)
          array={new Float32Array(1000 * 2 * 3)} // 1000 lines * 2 vertices/line * 3 coords/vertex
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  )
}

function Edges() {
  const lineRef = useRef<THREE.LineSegments>(null)
  const attributeRef = useRef<THREE.BufferAttribute>(null)
  const { glyphKey, wavelength, intensity, edges } = useQuantumSphereStore()

  useEffect(() => {
    if (!lineRef.current || !attributeRef.current) return

    const positions = attributeRef.current.array as Float32Array
    const currentGlyph = GLYPHS[glyphKey]
    let lineSegmentsCount = 0

    if (edges && currentGlyph?.edges && currentGlyph.nodes) {
      currentGlyph.edges.forEach((edgePath) => {
        for (let i = 0; i < edgePath.length - 1; i++) {
          const nodeMapIdx1 = edgePath[i]
          const nodeMapIdx2 = edgePath[i + 1]

          // Check if mapped indices are valid for currentGlyph.nodes
          if (
            nodeMapIdx1 < 0 ||
            nodeMapIdx1 >= currentGlyph.nodes.length ||
            nodeMapIdx2 < 0 ||
            nodeMapIdx2 >= currentGlyph.nodes.length
          )
            continue

          const actualNodeIdx1 = currentGlyph.nodes[nodeMapIdx1]
          const actualNodeIdx2 = currentGlyph.nodes[nodeMapIdx2]

          // Check if actual node indices are valid for spherePoints
          if (
            actualNodeIdx1 < 0 ||
            actualNodeIdx1 >= spherePoints.length ||
            actualNodeIdx2 < 0 ||
            actualNodeIdx2 >= spherePoints.length
          )
            continue

          if (lineSegmentsCount * 6 + 5 < positions.length) {
            // Check bounds for positions array
            const p1 = spherePoints[actualNodeIdx1]
            const p2 = spherePoints[actualNodeIdx2]
            positions[lineSegmentsCount * 6 + 0] = p1.x
            positions[lineSegmentsCount * 6 + 1] = p1.y
            positions[lineSegmentsCount * 6 + 2] = p1.z
            positions[lineSegmentsCount * 6 + 3] = p2.x
            positions[lineSegmentsCount * 6 + 4] = p2.y
            positions[lineSegmentsCount * 6 + 5] = p2.z
            lineSegmentsCount++
          }
        }
      })
    }
    attributeRef.current.needsUpdate = true
    lineRef.current.geometry.setDrawRange(0, lineSegmentsCount * 2) // Draw 'lineSegmentsCount' lines (each line has 2 vertices)

    const material = lineRef.current.material as THREE.LineBasicMaterial
    material.color = wavelengthToColor(wavelength)
    material.opacity = 0.8 * intensity
  }, [glyphKey, edges, wavelength, intensity])

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          ref={attributeRef}
          attach="attributes-position"
          count={2000} // Max number of lines (e.g. 2000 lines = 4000 vertices)
          array={new Float32Array(2000 * 2 * 3)} // 2000 lines * 2 vertices/line * 3 coords/vertex
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} linewidth={2} />
    </lineSegments>
  )
}

/* ---------- SCENE CONTAINER & EXPORT ------------------- */
function SceneContainer() {
  const { spinRate } = useQuantumSphereStore()
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += (spinRate / 60) * (Math.PI * 2) * delta
    }
  })

  return (
    <group ref={groupRef}>
      <Prism />
      <NodeCloud />
      <Beams />
      <Edges />
    </group>
  )
}

export default function QuantumSphere() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
      <SceneContainer />
      <ambientLight intensity={0.25} />
    </Canvas>
  )
}
