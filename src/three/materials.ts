import * as THREE from 'three';

/** Flat ring that draws only the arc [0, uFrac] of a full turn, clockwise from 12 o'clock. */
export function arcRingMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uFrac: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 2 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFrac;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uOpacity;
      varying vec2 vPos;
      void main() {
        float a = atan(vPos.x, vPos.y);            // 0 at 12 o'clock, clockwise positive
        float f = fract(a / 6.28318530718 + 1.0);
        if (f > uFrac) discard;
        gl_FragColor = vec4(uColor * uIntensity, uOpacity);
      }`,
  });
}

/** Additive glowing ribbon with pulses moving along its arc length (attribute `aLen`, world units). */
export function flowMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uBase: { value: 0.12 },
    },
    vertexShader: /* glsl */ `
      attribute float aLen;
      attribute float aSide;
      varying float vLen;
      varying float vSide;
      void main() {
        vLen = aLen;
        vSide = aSide;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uActive;
      uniform vec3 uColor;
      uniform float uBase;
      varying float vLen;
      varying float vSide;
      void main() {
        float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
        float speed = mix(0.6, 3.2, uActive);
        float p = fract(vLen * 0.9 - uTime * speed);
        float pulse = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.08, 0.32, p));
        float glow = uBase + pulse * mix(0.35, 2.6, uActive) + uActive * 0.35;
        gl_FragColor = vec4(uColor * glow * edge, 1.0);
      }`,
  });
}

/** Soft radial glow sprite for additive halos (overload heat, LEDs). */
let radialTex: THREE.Texture | null = null;
export function radialGlowTexture(): THREE.Texture {
  if (radialTex) return radialTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  radialTex = new THREE.CanvasTexture(c);
  radialTex.colorSpace = THREE.SRGBColorSpace;
  return radialTex;
}

export const COLORS = {
  cool: new THREE.Color('#38e8ff'),
  hot: new THREE.Color('#ff2a1a'),
  warm: new THREE.Color('#ff8a3d'),
  idle: new THREE.Color('#1a3d4a'),
  ok: new THREE.Color('#57ff8a'),
  white: new THREE.Color('#ffffff'),
  gold: new THREE.Color('#ffc94d'),
};

/** Damp a value toward a target, frame-rate independent. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
