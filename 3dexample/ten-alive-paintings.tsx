"use client";

import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { audioAtom, breathingAtom } from "@/store/sphereAtoms";
import { Button } from "@/components/ui/button";

// Version configurations with unique aesthetics
const paintingConfigs = [
  {
    // 1. THE FUTURE WAS YESTERDAY - Retrofuturistic chrome and sunset
    name: "The Future Was Yesterday",
    ZOOM_FACTOR: 0.3,
    BASE_WAVE_AMPLITUDE: 0.2,
    RANDOM_WAVE_FACTOR: 0.15,
    WAVE_FREQUENCY: 2.5,
    TIME_FACTOR: 0.15,
    BASE_SWIRL_STRENGTH: 1.0,
    SWIRL_TIME_MULT: 3.0,
    NOISE_SWIRL_FACTOR: 0.2,
    FBM_OCTAVES: 6,
    SPECIAL_EFFECT: "chrome",
    colors: [
      [0.05, 0.0, 0.1], [0.1, 0.0, 0.2], [0.2, 0.0, 0.3], [0.3, 0.0, 0.4],
      [0.4, 0.0, 0.5], [0.5, 0.0, 0.6], [0.6, 0.1, 0.7], [0.7, 0.2, 0.8],
      [0.8, 0.3, 0.9], [0.9, 0.4, 0.8], [1.0, 0.5, 0.7], [1.0, 0.6, 0.6],
      [1.0, 0.7, 0.5], [1.0, 0.8, 0.4], [0.9, 0.9, 0.5], [0.8, 0.8, 0.7],
      [0.7, 0.7, 0.9], [0.6, 0.6, 1.0], [0.5, 0.5, 0.9], [0.4, 0.4, 0.8]
    ]
  },
  {
    // 2. SHADOWS TALK - Dark wisps with whispering shadows
    name: "Shadows Talk",
    ZOOM_FACTOR: 0.2,
    BASE_WAVE_AMPLITUDE: 0.4,
    RANDOM_WAVE_FACTOR: 0.3,
    WAVE_FREQUENCY: 4.0,
    TIME_FACTOR: 0.1,
    BASE_SWIRL_STRENGTH: 2.0,
    SWIRL_TIME_MULT: 5.0,
    NOISE_SWIRL_FACTOR: 0.35,
    FBM_OCTAVES: 10,
    SPECIAL_EFFECT: "shadows",
    colors: [
      [0.0, 0.0, 0.0], [0.02, 0.02, 0.02], [0.04, 0.04, 0.05], [0.06, 0.06, 0.08],
      [0.08, 0.08, 0.1], [0.1, 0.1, 0.15], [0.12, 0.12, 0.2], [0.14, 0.14, 0.25],
      [0.16, 0.16, 0.3], [0.18, 0.18, 0.35], [0.2, 0.2, 0.4], [0.15, 0.15, 0.5],
      [0.1, 0.1, 0.6], [0.05, 0.05, 0.7], [0.0, 0.0, 0.8], [0.1, 0.0, 0.7],
      [0.2, 0.0, 0.6], [0.3, 0.0, 0.5], [0.2, 0.0, 0.4], [0.1, 0.0, 0.3]
    ]
  },
  {
    // 3. MIRRORS WALK - Reflective metallic surfaces
    name: "Mirrors Walk",
    ZOOM_FACTOR: 0.25,
    BASE_WAVE_AMPLITUDE: 0.25,
    RANDOM_WAVE_FACTOR: 0.1,
    WAVE_FREQUENCY: 3.0,
    TIME_FACTOR: 0.25,
    BASE_SWIRL_STRENGTH: 1.2,
    SWIRL_TIME_MULT: 2.5,
    NOISE_SWIRL_FACTOR: 0.15,
    FBM_OCTAVES: 5,
    SPECIAL_EFFECT: "mirror",
    colors: [
      [0.1, 0.1, 0.1], [0.2, 0.2, 0.2], [0.3, 0.3, 0.3], [0.4, 0.4, 0.4],
      [0.5, 0.5, 0.5], [0.6, 0.6, 0.6], [0.7, 0.7, 0.7], [0.8, 0.8, 0.8],
      [0.9, 0.9, 0.9], [1.0, 1.0, 1.0], [0.9, 0.95, 1.0], [0.8, 0.9, 1.0],
      [0.7, 0.85, 1.0], [0.6, 0.8, 1.0], [0.5, 0.75, 1.0], [0.4, 0.7, 1.0],
      [0.3, 0.65, 1.0], [0.2, 0.6, 1.0], [0.1, 0.55, 1.0], [0.0, 0.5, 1.0]
    ]
  },
  {
    // 4. SIGNALS STALK - Digital interference patterns
    name: "Signals Stalk",
    ZOOM_FACTOR: 0.35,
    BASE_WAVE_AMPLITUDE: 0.15,
    RANDOM_WAVE_FACTOR: 0.35,
    WAVE_FREQUENCY: 5.0,
    TIME_FACTOR: 0.3,
    BASE_SWIRL_STRENGTH: 0.8,
    SWIRL_TIME_MULT: 6.0,
    NOISE_SWIRL_FACTOR: 0.4,
    FBM_OCTAVES: 9,
    SPECIAL_EFFECT: "glitch",
    colors: [
      [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 0.0], [1.0, 0.0, 0.0],
      [0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [1.0, 1.0, 0.0],
      [0.0, 0.0, 0.0], [0.0, 1.0, 1.0], [0.0, 0.0, 0.0], [1.0, 0.0, 1.0],
      [0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [0.0, 0.0, 0.0], [0.5, 1.0, 0.5],
      [0.0, 0.0, 0.0], [1.0, 0.5, 0.5], [0.0, 0.0, 0.0], [0.5, 0.5, 1.0]
    ]
  },
  {
    // 5. SOVEREIGNTY WAITS - Royal purples and golds
    name: "Sovereignty Waits",
    ZOOM_FACTOR: 0.28,
    BASE_WAVE_AMPLITUDE: 0.35,
    RANDOM_WAVE_FACTOR: 0.15,
    WAVE_FREQUENCY: 2.8,
    TIME_FACTOR: 0.12,
    BASE_SWIRL_STRENGTH: 1.8,
    SWIRL_TIME_MULT: 3.5,
    NOISE_SWIRL_FACTOR: 0.22,
    FBM_OCTAVES: 7,
    SPECIAL_EFFECT: "royal",
    colors: [
      [0.05, 0.0, 0.1], [0.1, 0.0, 0.2], [0.15, 0.0, 0.3], [0.2, 0.0, 0.4],
      [0.25, 0.0, 0.5], [0.3, 0.0, 0.6], [0.35, 0.0, 0.7], [0.4, 0.0, 0.8],
      [0.5, 0.0, 0.9], [0.6, 0.0, 1.0], [0.7, 0.1, 0.9], [0.8, 0.2, 0.8],
      [0.9, 0.3, 0.7], [1.0, 0.4, 0.6], [1.0, 0.5, 0.5], [1.0, 0.6, 0.4],
      [1.0, 0.7, 0.3], [1.0, 0.8, 0.2], [1.0, 0.9, 0.1], [1.0, 1.0, 0.0]
    ]
  },
  {
    // 6. BEFORE AND AFTER THE GATES - Portal effects
    name: "Before and After the Gates",
    ZOOM_FACTOR: 0.22,
    BASE_WAVE_AMPLITUDE: 0.5,
    RANDOM_WAVE_FACTOR: 0.25,
    WAVE_FREQUENCY: 3.2,
    TIME_FACTOR: 0.18,
    BASE_SWIRL_STRENGTH: 2.5,
    SWIRL_TIME_MULT: 4.5,
    NOISE_SWIRL_FACTOR: 0.3,
    FBM_OCTAVES: 8,
    SPECIAL_EFFECT: "portal",
    colors: [
      [0.0, 0.0, 0.0], [0.0, 0.0, 0.2], [0.0, 0.0, 0.4], [0.0, 0.0, 0.6],
      [0.0, 0.0, 0.8], [0.0, 0.0, 1.0], [0.0, 0.2, 1.0], [0.0, 0.4, 1.0],
      [0.0, 0.6, 1.0], [0.0, 0.8, 1.0], [0.0, 1.0, 1.0], [0.0, 1.0, 0.8],
      [0.0, 1.0, 0.6], [0.0, 1.0, 0.4], [0.0, 1.0, 0.2], [0.0, 1.0, 0.0],
      [0.2, 1.0, 0.0], [0.4, 1.0, 0.0], [0.6, 1.0, 0.0], [0.8, 1.0, 0.0]
    ]
  },
  {
    // 7. A PATH OF LIGHT - Luminous trails
    name: "A Path of Light",
    ZOOM_FACTOR: 0.24,
    BASE_WAVE_AMPLITUDE: 0.2,
    RANDOM_WAVE_FACTOR: 0.2,
    WAVE_FREQUENCY: 3.5,
    TIME_FACTOR: 0.2,
    BASE_SWIRL_STRENGTH: 1.0,
    SWIRL_TIME_MULT: 2.0,
    NOISE_SWIRL_FACTOR: 0.18,
    FBM_OCTAVES: 6,
    SPECIAL_EFFECT: "light_trails",
    colors: [
      [0.0, 0.0, 0.0], [0.1, 0.05, 0.0], [0.2, 0.1, 0.0], [0.3, 0.15, 0.0],
      [0.4, 0.2, 0.0], [0.5, 0.25, 0.0], [0.6, 0.3, 0.0], [0.7, 0.35, 0.0],
      [0.8, 0.4, 0.0], [0.9, 0.45, 0.0], [1.0, 0.5, 0.0], [1.0, 0.6, 0.1],
      [1.0, 0.7, 0.2], [1.0, 0.8, 0.3], [1.0, 0.9, 0.4], [1.0, 1.0, 0.5],
      [1.0, 1.0, 0.6], [1.0, 1.0, 0.7], [1.0, 1.0, 0.8], [1.0, 1.0, 1.0]
    ]
  },
  {
    // 8. THE GLYPH SHINES BRIGHT - Ancient symbols
    name: "The Glyph Shines Bright",
    ZOOM_FACTOR: 0.26,
    BASE_WAVE_AMPLITUDE: 0.3,
    RANDOM_WAVE_FACTOR: 0.1,
    WAVE_FREQUENCY: 4.0,
    TIME_FACTOR: 0.15,
    BASE_SWIRL_STRENGTH: 1.5,
    SWIRL_TIME_MULT: 3.8,
    NOISE_SWIRL_FACTOR: 0.25,
    FBM_OCTAVES: 7,
    SPECIAL_EFFECT: "glyph",
    colors: [
      [0.0, 0.0, 0.05], [0.0, 0.05, 0.1], [0.0, 0.1, 0.15], [0.0, 0.15, 0.2],
      [0.0, 0.2, 0.25], [0.0, 0.25, 0.3], [0.0, 0.3, 0.35], [0.0, 0.35, 0.4],
      [0.0, 0.4, 0.45], [0.0, 0.45, 0.5], [0.0, 0.5, 0.6], [0.0, 0.6, 0.7],
      [0.0, 0.7, 0.8], [0.0, 0.8, 0.9], [0.0, 0.9, 1.0], [0.1, 1.0, 1.0],
      [0.2, 1.0, 1.0], [0.3, 1.0, 1.0], [0.4, 1.0, 1.0], [0.5, 1.0, 1.0]
    ]
  },
  {
    // 9. I WALK ALONE - Solitary journey
    name: "I Walk Alone",
    ZOOM_FACTOR: 0.3,
    BASE_WAVE_AMPLITUDE: 0.4,
    RANDOM_WAVE_FACTOR: 0.3,
    WAVE_FREQUENCY: 2.5,
    TIME_FACTOR: 0.08,
    BASE_SWIRL_STRENGTH: 2.0,
    SWIRL_TIME_MULT: 5.5,
    NOISE_SWIRL_FACTOR: 0.35,
    FBM_OCTAVES: 9,
    SPECIAL_EFFECT: "solitude",
    colors: [
      [0.0, 0.0, 0.02], [0.02, 0.02, 0.05], [0.04, 0.04, 0.08], [0.06, 0.06, 0.11],
      [0.08, 0.08, 0.14], [0.1, 0.1, 0.17], [0.12, 0.12, 0.2], [0.14, 0.14, 0.23],
      [0.16, 0.16, 0.26], [0.18, 0.18, 0.29], [0.2, 0.2, 0.32], [0.22, 0.22, 0.35],
      [0.24, 0.24, 0.38], [0.26, 0.26, 0.41], [0.28, 0.28, 0.44], [0.3, 0.3, 0.47],
      [0.25, 0.25, 0.5], [0.2, 0.2, 0.45], [0.15, 0.15, 0.4], [0.1, 0.1, 0.35]
    ]
  },
  {
    // 10. TO ALEPH ONE NULL - Mathematical infinity
    name: "To Aleph One Null",
    ZOOM_FACTOR: 0.25,
    BASE_WAVE_AMPLITUDE: 0.3,
    RANDOM_WAVE_FACTOR: 0.2,
    WAVE_FREQUENCY: 3.14159,
    TIME_FACTOR: 0.2,
    BASE_SWIRL_STRENGTH: 1.618,
    SWIRL_TIME_MULT: 4.0,
    NOISE_SWIRL_FACTOR: 0.25,
    FBM_OCTAVES: 8,
    SPECIAL_EFFECT: "infinity",
    colors: [
      [0.01, 0.01, 0.02], [0.02, 0.02, 0.05], [0.03, 0.02, 0.08], [0.05, 0.0, 0.12],
      [0.1, 0.0, 0.2], [0.2, 0.0, 0.3], [0.3, 0.0, 0.5], [0.5, 0.0, 0.8],
      [0.7, 0.0, 1.0], [0.9, 0.0, 0.9], [1.0, 0.0, 0.7], [1.0, 0.0, 0.5],
      [1.0, 0.0, 0.3], [1.0, 0.1, 0.1], [1.0, 0.3, 0.0], [1.0, 0.5, 0.0],
      [0.7, 1.0, 0.0], [0.0, 1.0, 0.5], [0.0, 1.0, 0.8], [0.0, 0.8, 1.0]
    ]
  }
];

// Build fragment shader based on config
function buildFragmentShader(config: any): string {
  const fbmOctavesInt = Math.floor(config.FBM_OCTAVES);
  const colorArraySrc = config.colors
    .map((c: number[]) => `vec3(${c[0]}, ${c[1]}, ${c[2]})`)
    .join(",\n  ");

  // Special effects based on theme
  let specialEffectCode = "";
  
  if (config.SPECIAL_EFFECT === "chrome") {
    specialEffectCode = `
    // Chrome effect
    float chrome = sin(n * 10.0 + uTime) * 0.5 + 0.5;
    color = mix(color, vec3(chrome), 0.3);
    `;
  } else if (config.SPECIAL_EFFECT === "shadows") {
    specialEffectCode = `
    // Shadow whispers
    float shadow = 1.0 - smoothstep(0.0, 1.0, abs(n));
    color *= shadow;
    `;
  } else if (config.SPECIAL_EFFECT === "mirror") {
    specialEffectCode = `
    // Mirror reflections
    float mirror = abs(sin(angle * 4.0 + uTime));
    color = mix(color, vec3(mirror), 0.5);
    `;
  } else if (config.SPECIAL_EFFECT === "glitch") {
    specialEffectCode = `
    // Digital glitch
    float glitch = step(0.95, fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453));
    color = mix(color, 1.0 - color, glitch);
    `;
  } else if (config.SPECIAL_EFFECT === "portal") {
    specialEffectCode = `
    // Portal vortex
    float portal = 1.0 / (1.0 + r * r);
    color *= portal;
    `;
  } else if (config.SPECIAL_EFFECT === "light_trails") {
    specialEffectCode = `
    // Light trails
    float trail = smoothstep(0.0, 1.0, abs(sin(angle * 8.0 + uTime * 2.0)));
    color += vec3(trail) * 0.3;
    `;
  } else if (config.SPECIAL_EFFECT === "glyph") {
    specialEffectCode = `
    // Ancient glyphs
    float glyph = sin(uv.x * 20.0) * sin(uv.y * 20.0);
    color += vec3(0.0, 0.5, 1.0) * step(0.9, glyph) * 0.5;
    `;
  } else if (config.SPECIAL_EFFECT === "solitude") {
    specialEffectCode = `
    // Lonely path
    float path = 1.0 - smoothstep(0.0, 0.2, abs(uv.y));
    color = mix(color * 0.5, color, path);
    `;
  } else if (config.SPECIAL_EFFECT === "infinity") {
    specialEffectCode = `
    // Mathematical infinity
    float infinity = sin(log(r + 0.1) * 10.0 + uTime);
    color = mix(color, color.bgr, infinity * 0.3);
    `;
  }

  return `#version 300 es

precision highp float;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;

#define NUM_COLORS 20
#define PI 3.14159265359

vec3 paintingColors[NUM_COLORS] = vec3[](
  ${colorArraySrc}
);

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float noise2D(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) +
    i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.792843 - 0.853734 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float freq = 1.0;
  for (int i = 0; i < ${fbmOctavesInt}; i++) {
    value += amplitude * noise2D(st * freq);
    freq *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float md = 5.0;
  vec2 mr;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(i, j);
      vec2 o = 0.5 + 0.5 * sin(uTime * 0.1 + 6.2831 * vec2(
        noise2D(n + g + vec2(0.0, 0.0)),
        noise2D(n + g + vec2(1.0, 1.0))
      ));
      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < md) {
        md = d;
        mr = r;
      }
    }
  }

  return md;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  vec2 originalUV = uv;
  uv *= float(${config.ZOOM_FACTOR});

  float t = uTime * float(${config.TIME_FACTOR});

  float waveAmp = float(${config.BASE_WAVE_AMPLITUDE}) + float(${config.RANDOM_WAVE_FACTOR})
                  * noise2D(vec2(t * 0.5, 27.7));

  float waveX = waveAmp * sin(uv.y * float(${config.WAVE_FREQUENCY}) + t);
  float waveY = waveAmp * sin(uv.x * float(${config.WAVE_FREQUENCY}) - t);
  uv.x += waveX;
  uv.y += waveY;

  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float swirlStrength = float(${config.BASE_SWIRL_STRENGTH})
                        * (1.0 - smoothstep(0.0, 1.0, r));

  angle += swirlStrength * sin(uTime * 0.8 + r * float(${config.SWIRL_TIME_MULT}));
  uv = vec2(cos(angle), sin(angle)) * r;

  float n = fbm(uv);
  float v = voronoi(uv * 3.0 + t * 0.2);
  n = mix(n, v, 0.3);

  float swirlEffect = float(${config.NOISE_SWIRL_FACTOR})
                      * sin(t + n * 3.0);
  n += swirlEffect;

  float noiseVal = 0.5 * (n + 1.0);

  float idx = clamp(noiseVal, 0.0, 1.0) * float(NUM_COLORS - 1);
  int iLow = int(floor(idx));
  int iHigh = int(min(float(iLow + 1), float(NUM_COLORS - 1)));
  float f = fract(idx);

  vec3 colLow = paintingColors[iLow];
  vec3 colHigh = paintingColors[iHigh];
  vec3 color = mix(colLow, colHigh, f);

  ${specialEffectCode}

  if (iLow == 0 && iHigh == 0) {
    outColor = vec4(color, 0.0);
  } else {
    outColor = vec4(color, 1.0);
  }
}
`;
}

const vertexShaderSource = `#version 300 es
precision mediump float;

in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

function createShaderProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  if (!vertexShader) return null;

  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
    gl.deleteShader(vertexShader);
    return null;
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragmentShader) {
    gl.deleteShader(vertexShader);
    return null;
  }

  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error(
      "Fragment shader error:",
      gl.getShaderInfoLog(fragmentShader)
    );
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      "Could not link WebGL program:",
      gl.getProgramInfoLog(program)
    );
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

// Individual AbstractPainting component
interface AbstractPaintingProps {
  config?: any;
}

export function AbstractPainting({ config = paintingConfigs[0] }: AbstractPaintingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fsSource = buildFragmentShader(config);

    const gl = canvas.getContext("webgl2", { alpha: true });
    if (!gl) {
      console.error("WebGL2 is not supported by your browser.");
      return;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const program = createShaderProgram(gl, vertexShaderSource, fsSource);
    if (!program) {
      console.error("Failed to create shader program.");
      return;
    }

    programRef.current = program;
    gl.useProgram(program);

    const quadVertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const aPositionLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolutionLoc = gl.getUniformLocation(program, "uResolution");
    const uTimeLoc = gl.getUniformLocation(program, "uTime");

    const startTime = performance.now();

    function render() {
      const currentTime = performance.now();
      const elapsed = (currentTime - startTime) * 0.001;

      if (!canvas || !gl) {
        return;
      }

      if (
        canvas.width !== window.innerWidth ||
        canvas.height !== window.innerHeight
      ) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(uTimeLoc, elapsed);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameRef.current = requestAnimationFrame(render);
    }

    render();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      gl.deleteProgram(programRef.current);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: "transparent" }}
    />
  );
}

// Main showcase component
export default function TenAbstractPaintings() {
  const [selectedPainting, setSelectedPainting] = useState(0);

  return (
    <div className="w-full h-screen bg-black">
      {/* Full screen painting */}
      <div className="absolute inset-0">
        <AbstractPainting config={paintingConfigs[selectedPainting]} />
      </div>

      {/* Overlay with title and navigation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full flex flex-col justify-between p-8">
          {/* Title */}
          <div className="text-white">
            <h1 className="text-6xl font-bold mb-2">
              {paintingConfigs[selectedPainting].name}
            </h1>
            <p className="text-xl text-white/60">
              Living Abstract Painting {selectedPainting + 1} of 10
            </p>
          </div>

          {/* Navigation */}
          <div className="flex gap-4 pointer-events-auto">
            <button
              onClick={() => setSelectedPainting((selectedPainting - 1 + 10) % 10)}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all"
            >
              Previous
            </button>
            <div className="flex gap-2 items-center">
              {paintingConfigs.map((_, index) => (
                <Button
                  key={index}
                  onClick={() => setSelectedPainting(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === selectedPainting 
                      ? "bg-white w-8" 
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setSelectedPainting((selectedPainting + 1) % 10)}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}