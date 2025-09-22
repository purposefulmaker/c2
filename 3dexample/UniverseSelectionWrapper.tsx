// src/components/UniverseSelectionWrapper.tsx

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import UniverseSelection from './UniverseSelection';
import { UniverseOption } from './UniverseOptions';

interface UniverseSelectionWrapperProps {
  universes: UniverseOption[];
  onSelect: (option: UniverseOption) => void;
  onBackToIntro: () => void;
}

export default function UniverseSelectionWrapper(props: UniverseSelectionWrapperProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 20], fov: 75 }}
      // Safari-friendly: cap devicePixelRatio to avoid huge buffer
      dpr={Math.min(window.devicePixelRatio, 2)}
    >
      <Suspense fallback={
        <Html center>
          <div className="flex items-center gap-2 text-white text-lg font-light">
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        Loading Universe
          </div>
        </Html>
      }>
        {/* The core 3D scene is UniverseSelection */}
        <UniverseSelection {...props} />
        {/* Basic orbit controls so user can look around */}
        <OrbitControls
          enableZoom
          enablePan
          enableRotate
          minDistance={15}
          maxDistance={25}
        />
      </Suspense>
    </Canvas>
  );
}
