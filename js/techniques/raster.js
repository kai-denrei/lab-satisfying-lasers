import * as THREE from 'three';

export const meta = {
  id: 'raster',
  name: 'Pixel raster',
  blurb: 'Hard-stepped bands on a quantised grid. No smooth falloff anywhere.',
  props: {
    drawCalls: 1,
    geometry: '~386 verts',
    depth: 'flat — no thickness',
    cost: 'very low',
    fits: 'partial',
    why: 'Shares the ribbon geometry but inverts its aesthetic: every smoothstep becomes a step, and both axes snap to a virtual pixel grid. It fits the shared engine only if "no antialiasing anywhere" is a parameter rather than a different shader — which is a real architectural question, not a cosmetic one.',
  },
};

const VERT = /* glsl */`
attribute float aU;
attribute float aV;
uniform vec3 uStart, uEnd;
uniform float uGlowWidth, uPixels;
varying float vU, vV;
void main(){
  vU = aU; vV = aV;
  vec3 dir = normalize(uEnd - uStart);
  vec3 p = mix(uStart, uEnd, aU);
  vec3 side = normalize(cross(dir, normalize(cameraPosition - p)));
  p += side * (aV * uGlowWidth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */`
#include <common>
uniform vec3  uGlowColor, uCoreColor;
uniform float uGlowIntensity, uCoreIntensity, uCoreRatio, uAlpha, uPixels, uTime, uScrollSpeed;
varying float vU, vV;

void main(){
  // Snap both axes to a virtual pixel grid — this is the whole idea.
  float step_ = 1.0 / uPixels;
  float av = floor(abs(vV) / step_) * step_;
  float u  = floor(vU * uPixels * 3.0) / (uPixels * 3.0);

  // Three hard bands, no interpolation between them.
  float core = 1.0 - step(uCoreRatio, av);
  float mid  = (1.0 - step(0.55, av)) - core;
  float out_ = (1.0 - step(1.0, av)) - core - mid;

  // Scanline flicker, also quantised in time.
  float tq = floor(uTime * 12.0) / 12.0;
  float on = step(0.35, fract(sin((u * 37.0 + tq * uScrollSpeed) * 12.9898) * 43758.5453));

  vec3 col = uCoreColor * core * uCoreIntensity
           + uGlowColor * mid  * uGlowIntensity
           + uGlowColor * out_ * uGlowIntensity * 0.35 * on;

  float caps = 1.0 - step(0.97, u);
  gl_FragColor = vec4(col * caps * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function create({ start, end }){
  const SEG = 192;
  const n = (SEG + 1) * 2;
  const aU = new Float32Array(n), aV = new Float32Array(n);
  const idx = new Uint16Array(SEG * 6);
  for (let i = 0; i <= SEG; i++){
    const u = i / SEG;
    aU[i*2] = u; aV[i*2] = -1;
    aU[i*2+1] = u; aV[i*2+1] = 1;
  }
  for (let i = 0; i < SEG; i++){
    const a = i*2; idx.set([a, a+2, a+1, a+1, a+2, a+3], i*6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3));
  geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  geo.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));

  const uniforms = {
    uStart:{value:start.clone()}, uEnd:{value:end.clone()},
    uGlowColor:{value:new THREE.Color('#ff2a1a')}, uCoreColor:{value:new THREE.Color('#fff')},
    uGlowIntensity:{value:1.5}, uCoreIntensity:{value:3}, uCoreRatio:{value:0.2},
    uGlowWidth:{value:0.3}, uPixels:{value:9}, uAlpha:{value:1},
    uTime:{value:0}, uScrollSpeed:{value:2.6},
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
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
      uniforms.uGlowWidth.value = p.glowWidth;
      uniforms.uScrollSpeed.value = p.scrollSpeed;
      uniforms.uAlpha.value = p.alpha;
    },
    dispose(){ geo.dispose(); mat.dispose(); },
  };
}
