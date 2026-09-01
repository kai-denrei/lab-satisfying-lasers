import * as THREE from 'three';
import { NOISE_GLSL } from './base.js';

export const meta = {
  id: 'tube',
  name: 'Extruded tube',
  blurb: 'Real cylinder geometry. Brightness follows the chord length the view ray takes through the tube.',
  props: {
    drawCalls: 1,
    geometry: '~1.2k verts',
    depth: 'true 3D volume',
    cost: 'low',
    fits: 'yes',
    why: 'For a cylinder, abs(dot(N, V)) is exactly proportional to the chord length through the tube, so a plain fresnel term is physically the right falloff — no fudge factor. Being real geometry it intersects and is occluded correctly, which the ribbon cannot do.',
  },
};

const VERT = /* glsl */`
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vU;
void main(){
  vU = uv.y;                     // cylinder runs along its own Y
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */`
#include <common>
${NOISE_GLSL}
uniform vec3  uGlowColor, uCoreColor;
uniform float uGlowIntensity, uCoreIntensity, uCoreWidth, uGlowWidth;
uniform float uScrollSpeed, uNoiseAmount, uTime, uAlpha;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vU;

void main(){
  vec3 V = normalize(cameraPosition - vWorldPos);
  // Chord length through a cylinder at view-offset r is proportional to
  // sqrt(1 - (r/R)^2), which for a cylinder surface IS abs(dot(N, V)).
  float chord = abs(dot(normalize(vNormalW), V));

  float glow = pow(chord, 2.2);
  float coreRatio = clamp(uCoreWidth / max(uGlowWidth, 1e-4), 0.0, 1.0);
  float core = smoothstep(1.0 - coreRatio * 1.4, 1.0, chord);

  float caps = smoothstep(0.0, 0.05, vU) * (1.0 - smoothstep(0.9, 1.0, vU));
  float n = fbm(vec2(vU * 7.0 - uTime * uScrollSpeed, 3.0));
  float interf = mix(1.0, n * 1.7, uNoiseAmount);

  vec3 col = uGlowColor * glow * uGlowIntensity * interf
           + uCoreColor * core * uCoreIntensity;
  col *= caps * uAlpha;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function create({ start, end }){
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();

  const uniforms = {
    uGlowColor:{value:new THREE.Color('#ff2a1a')}, uCoreColor:{value:new THREE.Color('#fff')},
    uGlowIntensity:{value:1.5}, uCoreIntensity:{value:3}, uCoreWidth:{value:0.05},
    uGlowWidth:{value:0.3}, uScrollSpeed:{value:2.6}, uNoiseAmount:{value:0.35},
    uTime:{value:0}, uAlpha:{value:1},
  };

  const geo = new THREE.CylinderGeometry(1, 1, len, 28, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.renderOrder = 10;

  return {
    object: mesh,
    update(t, p){
      uniforms.uTime.value = t;
      uniforms.uGlowColor.value.set(p.glowColor);
      uniforms.uCoreColor.value.set(p.coreColor);
      uniforms.uGlowIntensity.value = p.glowIntensity;
      uniforms.uCoreIntensity.value = p.coreIntensity;
      uniforms.uCoreWidth.value = p.coreWidth;
      uniforms.uGlowWidth.value = p.glowWidth;
      uniforms.uScrollSpeed.value = p.scrollSpeed;
      uniforms.uNoiseAmount.value = p.noiseAmount;
      uniforms.uAlpha.value = p.alpha;
      mesh.scale.set(p.glowWidth, 1, p.glowWidth); // radius follows glow width
    },
    dispose(){ geo.dispose(); mat.dispose(); },
  };
}
