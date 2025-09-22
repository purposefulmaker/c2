// src/components/UniverseSelection.tsx

import { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { UniverseOption } from './UniverseOptions';
import { MultiStepLoader } from './ui/multi-step-loader';
import type { GalleryType } from '../types/GalleryTypes';
import GalleryTypeSelector from './GalleryTypeSelector';
import UniverseSphereMesh from './UniverseSphereMesh';
import SpaceBackground from './SpaceBackground';

interface UniverseSelectionProps {
  universes: UniverseOption[];
  onSelect: (option: UniverseOption) => void;
  onBackToIntro: () => void;
}

export default function UniverseSelection({
  universes,
  onSelect,
  onBackToIntro,
}: UniverseSelectionProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<GalleryType>('particle');

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = (option: UniverseOption) => {
    // Navigate to the gallery route, e.g. /gallery/:id/:type
    navigate(`/gallery/${option.id}/${selectedType}`);
  };

  // if the data isn't ready or is empty, show a fullscreen loader
  if (loading || universes.length === 0) {
    return (
      <group>
        {/* <group> so we don't try to render raw <div> in the scene */}
        <Html center>
          <div className="w-full h-screen flex items-center justify-center">
            <MultiStepLoader
              loadingStates={[
                { text: 'Creating celestial spheres...' },
                { text: 'Aligning cosmic energies...' },
                { text: 'Preparing your journey...' },
              ]}
              loading={true}
              duration={5000}
            />
          </div>
        </Html>
      </group>
    );
  }

  return (
    <>
      {/* Safari-friendly equirect background */}
      <SpaceBackground />

      {/* Basic lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 0, 0]} intensity={1} />

      {/* Layout spheres in a circle */}
      {universes.map((option, index) => {
        const radius = 12;
        const angle = (2 * Math.PI / universes.length) * index;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const y = Math.sin(angle * 2) * 2;

        return (
          <UniverseSphereMesh
            key={option.id}
            option={option}
            position={[x, y, z]}
            onSelect={handleSelect}
          />
        );
      })}

      {/* Title + Instructions */}
      <Html position={[0, 12, 0]} center style={{ position: 'relative', top: '20px' }}>
        <div className="text-center" style={{ width: '300px' }}>
          <h1
            className="text-shiny text-2xl font-serif mb-2"
            style={{
              color: '#fff',
              textShadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #0ff',
            }}
          >
            Select Your Universe
          </h1>
          <p
            className="text-white/80 text-md"
            style={{ textShadow: '0 0 5px rgba(255, 255, 255, 0.5)' }}
          >
            Click a sphere to explore its memories
          </p>
        </div>
      </Html>

      {/* Gallery type selection as a fullscreen overlay */}
      <Html fullscreen>
        <GalleryTypeSelector selectedType={selectedType} onSelect={setSelectedType} />
      </Html>
    </>
  );
}
// src/components/AccomplishmentGallery.tsx