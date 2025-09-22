// src/components/SpaceBackground.tsx

import React, { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MultiStepLoader } from './ui/multi-step-loader';

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

const SpaceBackground: React.FC = () => {
  const { scene, gl } = useThree();
  const [loaded, setLoaded] = useState(false);

  // The big equirectangular background URL:
  const textureUrl =
    'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738979543/AdobeStock_1151209908_wdwx5l.jpg';

  // Load the raw texture
  const rawTex = useTexture(textureUrl);

  useEffect(() => {
    if (!rawTex) return;
    const isWebGL2 = gl.capabilities.isWebGL2;
    rawTex.colorSpace = isWebGL2 ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    rawTex.mapping = THREE.EquirectangularReflectionMapping;
    rawTex.minFilter = THREE.LinearFilter;
    rawTex.magFilter = THREE.LinearFilter;

    const maxSize = gl.capabilities.maxTextureSize || 8192;
    if (rawTex.image instanceof HTMLImageElement) {
      downscaleImageIfNecessary(rawTex.image, maxSize).then((rescaledImg) => {
        if (rescaledImg !== rawTex.image) {
          rawTex.image = rescaledImg;
          rawTex.needsUpdate = true;
        }

        // Convert to a PMREM env map
        const pmremGen = new THREE.PMREMGenerator(gl);
        pmremGen.compileEquirectangularShader();
        const envMap = pmremGen.fromEquirectangular(rawTex).texture;
        scene.background = envMap;
        pmremGen.dispose();
        rawTex.dispose();

        setLoaded(true);
      });
    } else {
      // If it's some compressed format
      const pmremGen = new THREE.PMREMGenerator(gl);
      pmremGen.compileEquirectangularShader();
      const envMap = pmremGen.fromEquirectangular(rawTex).texture;
      scene.background = envMap;
      pmremGen.dispose();
      rawTex.dispose();

      setLoaded(true);
    }

    return () => {
      // Cleanup
      scene.background = null;
    };
  }, [rawTex, scene, gl]);

  if (!loaded) {
    // If not loaded, we can show a small loader in center
    return (
      <Html center>
        <MultiStepLoader
          loadingStates={[{ text: 'Loading Universe...' }]}
          loading={true}
          duration={2000}
          loop={true}
          readyToClose={true}
        />
      </Html>
    );
  }

  return null;
};

export default SpaceBackground;
