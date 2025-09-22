// // src/components/Wormhole.tsx
// import { useFrame } from "@react-three/fiber";
// import { useRef, useState } from "react";
// import * as THREE from "three";

// const Wormhole = ({ isActive, onComplete }: { isActive: boolean; onComplete: () => void }) => {
//   const pointsRef = useRef<THREE.Points>(null);
//   const [particles] = useState(() => {
//     const geometry = new THREE.BufferGeometry();
//     const positions = new Float32Array(2000 * 3);
//     const colors = new Float32Array(2000 * 3);

//     for (let i = 0; i < positions.length; i += 3) {
//       const radius = Math.random() * 20;
//       const theta = Math.random() * Math.PI * 2;
//       const phi = Math.random() * Math.PI * 2;

//       positions[i] = radius * Math.cos(theta) * Math.sin(phi);
//       positions[i + 1] = radius * Math.sin(theta) * Math.sin(phi);
//       positions[i + 2] = radius * Math.cos(phi);

//       colors[i] = Math.random();
//       colors[i + 1] = Math.random();
//       colors[i + 2] = Math.random();
//     }

//     geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
//     geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

//     return geometry;
//   });

//   useFrame((state, delta) => {
//     if (isActive && pointsRef.current) {
//       pointsRef.current.rotation.z += delta * 2;
//       pointsRef.current.scale.multiplyScalar(0.98);

//       if (pointsRef.current.scale.x < 0.01) {
//         onComplete();
//       }
//     }
//   });

//   if (!isActive) return null;

//   return (
//     <points ref={pointsRef}>
//       <primitive object={particles} />
//       <pointsMaterial
//         size={0.1}
//         vertexColors
//         transparent
//         opacity={0.8}
//         blending={THREE.AdditiveBlending}
//       />
//     </points>
//   );
// };

// export default Wormhole;
