// src/components/UniverseSphereMesh.tsx

import React, { useRef, useState, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { UniverseOption } from './UniverseOptions';

async function downscaleImageIfNecessary(
  img: HTMLImageElement,
  maxSize: number
): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const { width, height } = img;
    if (width <= maxSize && height <= maxSize) {
      resolve(img);
      return;
    }
    const ratio = width > height ? maxSize / width : maxSize / height;
    const newW = Math.floor(width * ratio);
    const newH = Math.floor(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(img);
      return;
    }
    ctx.drawImage(img, 0, 0, newW, newH);

    const newImg = new Image();
    newImg.onload = () => resolve(newImg);
    newImg.src = canvas.toDataURL('image/png');
  });
}

interface UniverseSphereMeshProps {
  option: UniverseOption;
  position: [number, number, number];
  onSelect: (option: UniverseOption) => void;
}

const UniverseSphereMesh: React.FC<UniverseSphereMeshProps> = ({
  option,
  position,
  onSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(true);

  const { gl } = useThree();
  // Load texture from the option's URL
  const sphereTexture = useTexture(option.url, () => setLoading(false));

  // On mount or whenever texture changes, set up color encoding, etc.
  useEffect(() => {
    if (!sphereTexture) return;
    const isWebGL2 = gl.capabilities.isWebGL2;
    sphereTexture.colorSpace = isWebGL2 ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;


    // Downscale large textures if needed
    const maxSize = gl.capabilities.maxTextureSize || 4096;
    if (sphereTexture.image instanceof HTMLImageElement) {
      downscaleImageIfNecessary(sphereTexture.image, maxSize).then((rescaledImg) => {
        if (rescaledImg !== sphereTexture.image) {
          sphereTexture.image = rescaledImg;
          sphereTexture.needsUpdate = true;
        }
      });
    }
  }, [sphereTexture, gl]);

  // Animate rotation & scale on hover
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      const targetScale = hovered ? 1.2 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const handleClick = () => {
    if (!loading) {
      gsap.to(meshRef.current.scale, {
        x: 2,
        y: 2,
        z: 2,
        duration: 0.5,
        ease: 'power2.out',
        onComplete: () => onSelect(option),
      });
    }
  };

  if (loading) {
    return (
      <Html center position={position}>
        <div className="flex items-center gap-2 text-white text-lg font-light">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Loading Universe
        </div>
      </Html>
    );
  }

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial
          map={sphereTexture}
          metalness={0.5}
          roughness={0.5}
          envMapIntensity={1}
        />
      </mesh>
      <group position={[0, -2.5, 0]} scale={hovered ? 1.2 : 1}>
        <Html center distanceFactor={8}>
          <div className="text-white text-lg font-semibold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm whitespace-nowrap">
            {option.title}
          </div>
        </Html>
      </group>
    </group>
  );
};

export default UniverseSphereMesh;
