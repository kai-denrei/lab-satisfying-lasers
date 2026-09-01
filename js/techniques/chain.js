import * as THREE from 'three';

export const meta = {
  id: 'chain',
  name: 'Sprite chain',
  blurb: 'A row of billboarded quads with soft radial falloff — how a great many older games did it.',
  props: {
    drawCalls: 1,
    geometry: '24 quads',
    depth: 'flat, per-sprite',
    cost: 'low',
    fits: 'partial',
    why: 'Needs no beam-space UV at all, only a position per sprite, which makes it trivial to bend around corners or trail a projectile. The cost is banding: too few sprites and the beam reads as beads, too many and overdraw climbs fast. Turn the count down to see it fail.',
  },
};

const COUNT = 24;

const VERT = /* glsl */`
attribute vec2 aCorner;   // -1..1 quad corner
attribute float aT;       // 0..1 position along the beam
uniform vec3  uStart, uEnd;
uniform float uSize;
varying vec2 vCorner;
varying float vT;
void main(){
  vCorner = aCorner;
  vT = aT;
  vec3 p = mix(uStart, uEnd, aT);
  // Billboard: offset in view space so every sprite faces the camera.
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += aCorner * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */`
#include <common>
uniform vec3  uGlowColor, uCoreColor;
uniform float uGlowIntensity, uCoreIntensity, uCoreRatio, uAlpha, uTime, uNoiseAmount;
varying vec2 vCorner;
varying float vT;
void main(){
  float r = length(vCorner);
  if (r > 1.0) discard;
  float glow = pow(max(0.0, 1.0 - r), 2.2);
  float core = smoothstep(uCoreRatio, uCoreRatio * 0.3, r);
  float caps = smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.92, 1.0, vT));
  float flick = mix(1.0, 0.6 + 0.8 * fract(sin(vT * 91.7 + uTime * 3.0) * 43758.5), uNoiseAmount);
  vec3 col = uGlowColor * glow * uGlowIntensity * flick + uCoreColor * core * uCoreIntensity;
  gl_FragColor = vec4(col * caps * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function create({ start, end }){
  const corner = new Float32Array(COUNT * 4 * 2);
  const tAttr  = new Float32Array(COUNT * 4);
  const index  = new Uint16Array(COUNT * 6);
  const C = [[-1,-1],[1,-1],[-1,1],[1,1]];
  for (let i = 0; i < COUNT; i++){
    const t = COUNT === 1 ? 0.5 : i / (COUNT - 1);
    for (let k = 0; k < 4; k++){
      corner[(i*4+k)*2]   = C[k][0];
      corner[(i*4+k)*2+1] = C[k][1];
      tAttr[i*4+k] = t;
    }
    const b = i*4;
    index.set([b, b+1, b+2, b+2, b+1, b+3], i*6);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT*4*3), 3));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  geo.setAttribute('aT', new THREE.BufferAttribute(tAttr, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));

  const uniforms = {
    uStart:{value:start.clone()}, uEnd:{value:end.clone()},
    uGlowColor:{value:new THREE.Color('#ff2a1a')}, uCoreColor:{value:new THREE.Color('#fff')},
    uGlowIntensity:{value:1.5}, uCoreIntensity:{value:3}, uCoreRatio:{value:0.2},
    uSize:{value:0.3}, uAlpha:{value:1}, uTime:{value:0}, uNoiseAmount:{value:0.35},
  };

  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;

  return {
    object: mesh,
    update(t, p){
      uniforms.uTime.value = t;
      uniforms.uGlowColor.value.set(p.glowColor);
      uniforms.uCoreColor.value.set(p.coreColor);
      uniforms.uGlowIntensity.value = p.glowIntensity;
      uniforms.uCoreIntensity.value = p.coreIntensity;
      uniforms.uCoreRatio.value = Math.min(1, p.coreWidth / Math.max(p.glowWidth, 1e-4));
      uniforms.uSize.value = p.glowWidth * 1.6;
      uniforms.uNoiseAmount.value = p.noiseAmount;
      uniforms.uAlpha.value = p.alpha;
    },
    dispose(){ geo.dispose(); mat.dispose(); },
  };
}
