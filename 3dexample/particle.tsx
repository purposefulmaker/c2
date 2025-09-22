// ParticleGallery.tsx

import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree, extend, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import AudioToggle from "./AudioToggle";
import { Button } from "../components/ui/button";

// For older Safari compatibility, we do the fallback color space logic:
extend({ OrbitControls });

/* ─────────────────────────────────────────────────────────────
   (A) SAFARI/WEBGL1-FRIENDLY: DETECT & HANDLE ENCODING, LARGE TEXTURES
   ─────────────────────────────────────────────────────────────
*/
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

    const canvas = document.createElement("canvas");
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(img);
      return;
    }
    ctx.drawImage(img, 0, 0, newW, newH);

    const newImg = new Image();
    newImg.onload = () => resolve(newImg);
    newImg.src = canvas.toDataURL("image/png");
  });
}

/* ─────────────────────────────────────────────────────────────
   (1) SpaceBackground - Equirectangular + PMREM
   Will set scene.background / scene.environment
   ─────────────────────────────────────────────────────────────
*/
function SpaceBackground({ backgroundUrl }: { backgroundUrl: string }) {
  const { scene, gl } = useThree();
  const originalTexture = useTexture(backgroundUrl);

  useEffect(() => {
    if (!originalTexture) return;

    const isWebGL2 = gl.capabilities.isWebGL2;
    // If WebGL1, fallback to linear color space
    originalTexture.colorSpace = isWebGL2
      ? THREE.SRGBColorSpace
      : THREE.LinearSRGBColorSpace;

    originalTexture.mapping = THREE.EquirectangularReflectionMapping;

    // Downscale if it exceeds maxTextureSize:
    const maxSize = gl.capabilities.maxTextureSize || 4096;
    if (originalTexture.image instanceof HTMLImageElement) {
      const img = originalTexture.image;
      downscaleImageIfNecessary(img, maxSize).then((maybeResizedImg) => {
        if (maybeResizedImg !== img) {
          originalTexture.image = maybeResizedImg;
          originalTexture.needsUpdate = true;
        }
        const pmremGen = new THREE.PMREMGenerator(gl);
        pmremGen.compileEquirectangularShader();
        const envMap = pmremGen.fromEquirectangular(originalTexture).texture;

        scene.environment = envMap;
        scene.background = envMap;

        originalTexture.dispose();
        pmremGen.dispose();
      });
    } else {
      // Already compressed / not an HTML image
      const pmremGen = new THREE.PMREMGenerator(gl);
      pmremGen.compileEquirectangularShader();
      const envMap = pmremGen.fromEquirectangular(originalTexture).texture;
      scene.environment = envMap;
      scene.background = envMap;

      originalTexture.dispose();
      pmremGen.dispose();
    }

    return () => {
      scene.background = null;
      scene.environment = null;
    };
  }, [originalTexture, scene, gl, backgroundUrl]);

  return null;
}

/* ─────────────────────────────────────────────────────────────
   Utility: Random Positions for the star images
   ─────────────────────────────────────────────────────────────
*/
function getRandomPosition() {
  const radius = 30;
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return [x, y, z];
}

// ─────────────────────────────────────────────────────────────
// (3) GALLERY DATA
// ─────────────────────────────────────────────────────────────
const imagesData = [
    { id: 1, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053730/morefish_oqb6h1.jpg', position: getRandomPosition() },
    { id: 2, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053727/xmas_xoeikz.jpg', position: getRandomPosition() },
    { id: 3, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053726/fountain_ctoyty.jpg', position: getRandomPosition() },
    { id: 4, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053725/fish_zw7wva.jpg', position: getRandomPosition() },
    { id: 5, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053725/upclose_ey1efq.jpg', position: getRandomPosition() },
    { id: 6, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053724/beginning_v9oguu.jpg', position: getRandomPosition() },
    { id: 7, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053724/justus_z0cq0f.jpg', position: getRandomPosition() },
    { id: 8, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739053722/first_uohl9j.jpg', position: getRandomPosition() },
    { id: 9, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080243/IMG_9627_tvsy7z.jpg', position: getRandomPosition() },
    { id: 10, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080242/IMG_9338_svgd1t.jpg', position: getRandomPosition() },
    { id: 11, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080243/IMG_9348_dheoei.jpg', position: getRandomPosition() },
    { id: 12, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080242/IMG_4540_cyxkhq.png', position: getRandomPosition() },
    { id: 13, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080242/IMG_9620_tooz80.jpg', position: getRandomPosition() },
    { id: 14, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080242/View_recent_photos_mw7jd8.jpg', position: getRandomPosition() },
    { id: 15, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080241/IMG_8426_ic2ugq.jpg', position: getRandomPosition() },
    { id: 16, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080240/IMG_4576_cy93ko.png', position: getRandomPosition() },
    { id: 17, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080240/IMG_4654_j1uiui.png', position: getRandomPosition() },
    { id: 18, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080240/IMG_4599_xnyuzi.png', position: getRandomPosition() },
    { id: 19, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080232/IMG_6806_usl7aj.png', position: getRandomPosition() },
    { id: 20, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080239/IMG_8582_ykokmg.jpg', position: getRandomPosition() },
    { id: 21, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080234/IMG_6703_x7r9wx.jpg', position: getRandomPosition() },
    { id: 22, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080230/IMG_4545_ukn1hv.png', position: getRandomPosition() },
    { id: 23, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080229/IMG_5870_yxtz0z.jpg', position: getRandomPosition() },
    { id: 24, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080227/IMG_4056_o7sbuc.jpg', position: getRandomPosition() },
    { id: 25, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080226/IMG_4286_n5v9h8.jpg', position: getRandomPosition() },
    { id: 26, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080225/IMG_3010_mq8b3d.png', position: getRandomPosition() },
    { id: 27, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080225/IMG_4277_axtor3.jpg', position: getRandomPosition() },
    { id: 28, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080225/IMG_3007_hrvut1.png', position: getRandomPosition() },
    { id: 29, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080224/IMG_2996_uxaur0.png', position: getRandomPosition() },
    { id: 30, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080224/IMG_3694_l5aj3p.png', position: getRandomPosition() },
    { id: 31, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080223/IMG_2999_qg2h4s.png', position: getRandomPosition() },
    { id: 32, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080223/IMG_2992_td6l5m.png', position: getRandomPosition() },
    { id: 33, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080223/IMG_3005_fop3fo.png', position: getRandomPosition() },
    { id: 34, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080222/IMG_2990_x3wkop.png', position: getRandomPosition() },
    { id: 35, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080221/IMG_2986_obasyk.png', position: getRandomPosition() },
    { id: 36, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080218/IMG_2991_ul27og.png', position: getRandomPosition() },
    { id: 37, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080217/IMG_2977_napwut.png', position: getRandomPosition() },
    { id: 38, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080217/IMG_2974_iltuii.png', position: getRandomPosition() },
    { id: 39, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080217/IMG_2981_q3jvmo.png', position: getRandomPosition() },
    { id: 40, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080217/IMG_2973_cnppdu.png', position: getRandomPosition() },
    { id: 41, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080216/IMG_2898_vbfbqi.png', position: getRandomPosition() },
    { id: 42, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080215/IMG_2951_emfytu.png', position: getRandomPosition() },
    { id: 43, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080215/IMG_2952_mmpu7q.png', position: getRandomPosition() },
    { id: 44, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080215/IMG_1975_sfunkt.jpg', position: getRandomPosition() },
    { id: 45, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080215/IMG_1838_h7oyfr.jpg', position: getRandomPosition() },
    { id: 46, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080214/IMG_2921_b9cqt7.png', position: getRandomPosition() },
    { id: 47, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080213/IMG_2429_de8end.png', position: getRandomPosition() },
    { id: 48, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080213/IMG_2189_gb9xvr.png', position: getRandomPosition() },
    { id: 49, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080213/imagejpeg_1_bxnsgl.jpg', position: getRandomPosition() },
    { id: 50, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739080212/IMG_2427_artxqy.jpg', position: getRandomPosition() }
  ];
  
  // ─────────────────────────────────────────────────────────────
  interface GalleryImage {
    id: number;
    url: string;
    position: number[];
  }
  // ...


// ─────────────────────────────────────────────────────────────
// (4) Single "Star" Image in the 3D Space
// ─────────────────────────────────────────────────────────────
interface GalleryImage {
  id: number;
  url: string;
  position: number[];
}

function ImageStar({
  image,
  onSelect,
}: {
  image: GalleryImage;
  onSelect: (img: GalleryImage) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(image.url);
  const [hovered, setHovered] = useState(false);
  const colorShift = useRef(0);
  const glowIntensity = useRef(0);

  const { gl } = useThree();
  
  useEffect(() => {
    const isWebGL2 = gl.capabilities.isWebGL2;
    if (texture) {
      texture.colorSpace = isWebGL2 ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    }
  }, [texture, gl]);

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    gsap.to(meshRef.current.scale, {
      x: 8,
      y: 8, 
      z: 8,
      duration: 1,
      ease: "power2.out",
      onComplete: () => onSelect(image),
    });
  };

  const rotationSpeed = useRef(0);
  const lastHoverTime = useRef<number | null>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Dynamic color shifting
      colorShift.current += 0.01;
      const r = Math.sin(colorShift.current) * 0.5 + 0.5;
      const g = Math.sin(colorShift.current + 2) * 0.5 + 0.5;
      const b = Math.sin(colorShift.current + 4) * 0.5 + 0.5;

      if (hovered) {
        if (lastHoverTime.current === null) {
          lastHoverTime.current = Date.now();
        }
        
        glowIntensity.current = Math.min(1, glowIntensity.current + 0.05);
        rotationSpeed.current = Math.min(0.1, 0.01 + (Date.now() - lastHoverTime.current) / 1000 * 0.09);
        
        // Rainbow glow effect when hovered
        (meshRef.current.material as THREE.MeshStandardMaterial).emissive.setRGB(r, g, b);
        (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity.current;

        // Enhanced floating effect
        const time = state.clock.getElapsedTime();
        meshRef.current.position.x = image.position[0] + Math.sin(time * 2) * 0.05;
        meshRef.current.position.y = image.position[1] + Math.cos(time * 2) * 0.05;
        meshRef.current.position.z = image.position[2] + Math.sin(time * 3) * 0.05;
      } else {
        glowIntensity.current = Math.max(0.2, glowIntensity.current * 0.95);
        rotationSpeed.current = Math.max(0.005, rotationSpeed.current * 0.95);
        lastHoverTime.current = null;
        
        // Subtle color pulse when not hovered
        (meshRef.current.material as THREE.MeshStandardMaterial).emissive.setRGB(r * 0.2, g * 0.2, b * 0.2);
        (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity.current;
        
        // Smooth position return
        meshRef.current.position.lerp(new THREE.Vector3(...image.position), 0.1);
      }

      meshRef.current.rotation.y += rotationSpeed.current;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={image.position as [number, number, number]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial
        map={texture}
        metalness={0.7}
        roughness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// (5) Explosion Particles
// ─────────────────────────────────────────────────────────────
function ParticleExplosion({
  position,
  onComplete,
}: {
  position: number[];
  onComplete: () => void;
}) {
  const count = 10000;
  const colors = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      array[i * 3 + 0] = Math.random() * 0.5 + 0.5;
      array[i * 3 + 1] = Math.random() * 0.3;
      array[i * 3 + 2] = Math.random() * 0.8 + 0.2;
    }
    return array;
  }, [count]);

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      array[i * 3 + 0] = position[0];
      array[i * 3 + 1] = position[1];
      array[i * 3 + 2] = position[2];
    }
    return array;
  }, [position, count]);

  const velocities = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 15 + 8;
      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed;
      arr.push(new THREE.Vector3(vx, vy, vz));
    }
    return arr;
  }, [count]);

  const ref = useRef<THREE.Points>(null!);
  const startTime = useRef(performance.now());
  const explosionDuration = 5.0; // how long before onComplete

  useFrame(() => {
    const elapsed = (performance.now() - startTime.current) / 200; // adjust speed
    const posArray = ref.current.geometry.attributes.position.array as Float32Array;
    const colorArray = ref.current.geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const spiral = Math.sin(elapsed + i) * 1.0;
      posArray[i * 3 + 0] = position[0] + velocities[i].x * elapsed + spiral;
      posArray[i * 3 + 1] = position[1] + velocities[i].y * elapsed + spiral;
      posArray[i * 3 + 2] = position[2] + velocities[i].z * elapsed;

      const fade = Math.max(0, 1 - elapsed / explosionDuration);
      colorArray[i * 3 + 0] *= fade;
      colorArray[i * 3 + 1] *= fade;
      colorArray[i * 3 + 2] *= fade;
    }

    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.geometry.attributes.color.needsUpdate = true;

    if (elapsed > explosionDuration && onComplete) {
      onComplete();
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.8}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────────
   (6) ParticleImageTransition (Tetris-style Reassembly)
   ─────────────────────────────────────────────────────────────
*/
function ParticleImageTransition({
  image,
  onTransitionComplete,
}: {
  image: GalleryImage;
  onTransitionComplete: () => void;
}) {
  const texture = useTexture(image.url);
  const { gl } = useThree();

  useEffect(() => {
    const isWebGL2 = gl.capabilities.isWebGL2;
    if (texture) {
      texture.colorSpace = isWebGL2
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace;
    }
  }, [texture, gl]);

  const gridX = 80;
  const gridY = 80;
  const count = gridX * gridY;

  const finalPositions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < gridY; i++) {
      for (let j = 0; j < gridX; j++) {
        const idx = i * gridX + j;
        const x = (j / (gridX - 1)) * 6 - 3;
        const y = (i / (gridY - 1)) * 4 - 2;
        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = 0;
        uvs[idx * 2 + 0] = j / (gridX - 1);
        uvs[idx * 2 + 1] = i / (gridY - 1);
      }
    }
    return { positions, uvs };
  }, [gridX, gridY, count]);

  // chaotic initial positions
  const initialPositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 30 + 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, [count]);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(initialPositions, 3)
    );
    geom.setAttribute("uv", new THREE.BufferAttribute(finalPositions.uvs, 2));
    return geom;
  }, [initialPositions, finalPositions.uvs]);

  useEffect(() => {
    const timeline = gsap.timeline({ onComplete: onTransitionComplete });
    const positions = geometry.attributes.position.array as Float32Array;

    // Phase 1: gather to overhead area
    timeline.to(positions, {
      duration: 1,
      ease: "power2.inOut",
      onUpdate: function () {
        for (let i = 0; i < count; i++) {
          const y = 8 + Math.random() * 2;
          positions[i * 3 + 0] = finalPositions.positions[i * 3 + 0];
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = 0;
        }
        geometry.attributes.position.needsUpdate = true;
      },
    });

    // Phase 2: row by row falling
    const rowDelay = 0.05;
    for (let row = gridY - 1; row >= 0; row--) {
      timeline.to(
        positions,
        {
          duration: 0.3,
          delay: -0.2, // overlap
          ease: "bounce.out",
          onUpdate: function () {
            const progress = this.progress();
            for (let col = 0; col < gridX; col++) {
              const idx = row * gridX + col;
              const targetY = finalPositions.positions[idx * 3 + 1];
              const currentY = positions[idx * 3 + 1];
              if (Math.floor(idx / gridX) === row) {
                positions[idx * 3 + 0] = finalPositions.positions[idx * 3 + 0];
                positions[idx * 3 + 1] =
                  currentY + (targetY - currentY) * progress;
                positions[idx * 3 + 2] = finalPositions.positions[idx * 3 + 2];
              }
            }
            geometry.attributes.position.needsUpdate = true;
          },
        },
        `-=${rowDelay}`
      );
    }

    // Phase 3: final "shake" settle
    timeline.to(positions, {
      duration: 0.3,
      ease: "elastic.out(1, 0.3)",
      onUpdate: function () {
        const progress = this.progress();
        const shake = (1 - progress) * 0.1;
        for (let i = 0; i < count; i++) {
          positions[i * 3 + 0] =
            finalPositions.positions[i * 3 + 0] + (Math.random() - 0.5) * shake;
          positions[i * 3 + 1] =
            finalPositions.positions[i * 3 + 1] + (Math.random() - 0.5) * shake;
        }
        geometry.attributes.position.needsUpdate = true;
      },
    });
  }, [
    geometry,
    initialPositions,
    finalPositions.positions,
    count,
    gridX,
    gridY,
    onTransitionComplete,
  ]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.05}
        map={texture}
        transparent
        alphaTest={0.5}
        opacity={0.8}
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────────
   (7) ImageDetail
   User can click & drag the plane in 3D to reposition it.
   Also includes a "Print" button, calls window.print().
   ─────────────────────────────────────────────────────────────
*/
interface ImageDetailProps {
  image: GalleryImage;
  onBack: () => void;
  onBackToUniverse: () => void;
}

export function ImageDetail({
  image,
  onBack,
  onBackToUniverse,
}: ImageDetailProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(image.url);
  const { viewport, camera, gl } = useThree();

 // Let the user drag the plane in 3D
 const isDragging = useRef(false);
 const lastPointerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

 // Safari fallback
 useEffect(() => {
   const isWebGL2 = gl.capabilities.isWebGL2;
   if (texture) {
     texture.encoding = isWebGL2 ? THREE.sRGBEncoding : THREE.LinearEncoding;
   }
 }, [texture, gl]);

 // Fit plane to screen
 useEffect(() => {
   const updateGeometry = () => {
     if (texture.image && meshRef.current) {
       const imageAspect = texture.image.width / texture.image.height;
       const viewportAspect = viewport.width / viewport.height;
       let width, height;
       if (imageAspect > viewportAspect) {
         width = viewport.width * 0.5;
         height = width / imageAspect;
       } else {
         height = viewport.height * 0.5;
         width = height * imageAspect;
       }
       meshRef.current.scale.set(1, 1, 1);
       meshRef.current.geometry = new THREE.PlaneGeometry(width, height);
     }
   };

   texture.addEventListener("load", updateGeometry);
   updateGeometry();
   return () => {
     texture.removeEventListener("load", updateGeometry);
   };
 }, [texture, viewport]);

 // GSAP pop in
 useEffect(() => {
   gsap.fromTo(
     meshRef.current.scale,
     { x: 0.1, y: 0.1, z: 0.1 },
     { x: 1, y: 1, z: 1, duration: 0.5, ease: "power2.out" }
   );
 }, []);

 // Pointer events => drag the plane in 3D
 const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
   e.stopPropagation();
   isDragging.current = true;
   lastPointerPos.current = { x: e.clientX, y: e.clientY };
 };

 const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
   if (!isDragging.current) return;
   e.stopPropagation();

   // We can do a small offset in world space
   const deltaX = e.clientX - lastPointerPos.current.x;
   const deltaY = e.clientY - lastPointerPos.current.y;
   lastPointerPos.current = { x: e.clientX, y: e.clientY };

   // Convert pixel delta to a fraction of viewport
   const moveFactor = 0.002; // adjust speed
   const offsetX = -deltaX * moveFactor;
   const offsetY = deltaY * moveFactor;

    meshRef.current.position.x += offsetX; // or more advanced logic
    meshRef.current.position.y += offsetY;
    };

    const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
     e.stopPropagation();
     isDragging.current = false;
    };

    // Buttons
    const handlePrint = () => {
     window.print();
    };

    const buttonPosition = useMemo(() => {
     const yOffset = -viewport.height * 0.35;
     return [0, yOffset, 0] as [number, number, number];
    }, [viewport.height]);

    return (
   <group>
     {/* The plane with custom shader => rounding corners */}
     <mesh
       ref={meshRef}
       position={[0, 0, 0]}
       onPointerDown={handlePointerDown}
       onPointerMove={handlePointerMove}
       onPointerUp={handlePointerUp}
     >
       <planeGeometry args={[1, 1]} />
       <primitive
         object={new THREE.ShaderMaterial({
           transparent: true,
           side: THREE.DoubleSide,

           uniforms: {
             uTexture: { value: texture },
             uRadius: { value: 0.05 },
           },
           vertexShader: `
             varying vec2 vUv;
             void main() {
               vUv = uv;
               gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
             }
           `,
           fragmentShader: `
             uniform sampler2D uTexture;
             uniform float uRadius;
             varying vec2 vUv;

             float roundedBoxSDF(vec2 centerUV, vec2 size, float radius) {
                 vec2 q = abs(centerUV) - size + radius;
                 return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
             }

             void main() {
               vec2 centerUV = vUv * 2.0 - 1.0;
               float dist = roundedBoxSDF(centerUV, vec2(1.0), uRadius);
               if (dist > 0.0) {
                 discard;
               }
               vec4 color = texture2D(uTexture, vUv);
               gl_FragColor = color;
             }
           `,
         })}
       />
     </mesh>

      {/* UI for return/print */}
      <Html position={buttonPosition} transform>
        <div
          className="
            flex gap-2
            justify-center
            items-center
            p-2
            bg-black/40
            rounded
            backdrop-blur
          "
        >
          <Button
            variant="shimmer"
            size="sm"
            onClick={onBack}
            className="py-2 px-3 sm:px-4 text-xs sm:text-sm"
          >
            Gallery
          </Button>

          <Button
            variant="shimmer"
            size="sm"
            onClick={onBackToUniverse}
            className="py-2 px-3 sm:px-4 text-xs sm:text-sm"
          >
            Universe
          </Button>

          <Button
            variant="shimmer"
            size="sm"
            onClick={handlePrint}
            className="py-2 px-3 sm:px-4 text-xs sm:text-sm ml-3"
          >
            Print
          </Button>
        </div>
      </Html>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   (8) CameraController
   Just your existing camera tween
   ─────────────────────────────────────────────────────────────
*/
function CameraController({ selectedImage }: { selectedImage: GalleryImage | null }) {
  const { camera } = useThree();

  useEffect(() => {
    if (selectedImage) {
      gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: 8,
        duration: 1,
        ease: "power2.out",
        onUpdate: () => camera.lookAt(0, 0, 0),
      });
    } else {
      gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: 10,
        duration: 1,
        ease: "power2.out",
        onUpdate: () => camera.lookAt(0, 0, 0),
      });
    }
  }, [selectedImage, camera]);

  return null;
}

/* ─────────────────────────────────────────────────────────────
   (9) Gallery of 3D "Stars"
   ─────────────────────────────────────────────────────────────
*/
function Gallery({ onSelect }: { onSelect: (img: GalleryImage) => void }) {
  return (
    <>
      {imagesData.map((img) => (
        <ImageStar key={img.id} image={img} onSelect={onSelect} />
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   (10) Scene
   - Main logic: explosion => reassembly => detail
   - Renders a "Home" icon next to AudioToggle in bottom UI
   ─────────────────────────────────────────────────────────────
*/
function Scene({
  universeBackground,
  onBackToUniverse,
}: {
  universeBackground: string;
  onBackToUniverse: () => void;
}) {
  const [explodingImage, setExplodingImage] = useState<GalleryImage | null>(null);
  const [transitioningImage, setTransitioningImage] = useState<GalleryImage | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const handleSelect = (image: GalleryImage) => {
    setExplodingImage(image);
  };

  const handleExplosionComplete = () => {
    if (explodingImage) {
      setTransitioningImage(explodingImage);
      setExplodingImage(null);
    }
  };

  const handleTransitionComplete = () => {
    if (transitioningImage) {
      setSelectedImage(transitioningImage);
      setTransitioningImage(null);
    }
  };

  // "Home" button: for example, go to /intro or something
  const handleHome = () => {
    window.location.assign("/intro");
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />

      <SpaceBackground backgroundUrl={universeBackground} />
      <CameraController selectedImage={selectedImage} />

      {/* If no explosion / transition / detail => normal gallery */}
      {!explodingImage && !transitioningImage && !selectedImage && (
        <>
          <Gallery onSelect={handleSelect} />
          <Html position={[0, -3, 0]} center>
            <div className="flex gap-4 items-center">
              <button
                onClick={onBackToUniverse}
                className="px-4 py-2 text-sm cursor-pointer bg-black text-white rounded"
              >
                Back to Universe
              </button>

              {/* "Home" icon + AudioToggle */}
              <button
                onClick={handleHome}
                className="px-2 py-2 text-sm cursor-pointer bg-gray-700 text-white rounded flex items-center"
                style={{ gap: "4px" }}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                >
                  <path d="M3 9.75L12 4l9 5.75v8.5a2.75 2.75 0 01-2.75 2.75h-10.5A2.75 2.75 0 015 18.25v-8.5z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 22V12h6v10"
                  />
                </svg>
                Home
              </button>

              <AudioToggle />
            </div>
          </Html>
        </>
      )}

      {/* Explosion => reassembly => final detail */}
      {explodingImage && (
        <ParticleExplosion
          position={explodingImage.position}
          onComplete={handleExplosionComplete}
        />
      )}
      {transitioningImage && (
        <ParticleImageTransition
          image={transitioningImage}
          onTransitionComplete={handleTransitionComplete}
        />
      )}
      {selectedImage && (
        <ImageDetail
          image={selectedImage}
          onBack={() => setSelectedImage(null)}
          onBackToUniverse={onBackToUniverse}
        />
      )}

      <OrbitControls
        enableZoom
        enablePan
        enableRotate
        minDistance={1}
        maxDistance={100}
        rotateSpeed={1.0}
        zoomSpeed={1.2}
        panSpeed={1.0}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   (11) Main ParticleGallery Export
   ─────────────────────────────────────────────────────────────
*/
interface ParticleGalleryProps {
  universeBackground: string;
  onBackToUniverse: () => void;
}

export default function ParticleGallery({
  universeBackground,
  onBackToUniverse,
}: ParticleGalleryProps) {
  return (
    <Canvas
      shadows
      // Safari-friendly: limit pixel ratio
      dpr={Math.min(window.devicePixelRatio, 2)}
      camera={{ position: [0, 0, 10], fov: 75 }}
    >
      <Suspense
        fallback={
          <Html center>
        <span className="inline-block text-white text-lg font-medium animate-pulse">
          ✨ Crafting your gallery experience... 🌌
        </span>
          </Html>
        }
      >
        <Scene
          universeBackground={universeBackground}
          onBackToUniverse={onBackToUniverse}
        />
      </Suspense>
    </Canvas>
  );
}