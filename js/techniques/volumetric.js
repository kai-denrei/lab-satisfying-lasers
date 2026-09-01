import * as THREE from 'three';
import { NOISE_GLSL } from './base.js';

export const meta = {
  id: 'volumetric',
  name: 'Raymarched volume',
  blurb: 'Marches the view ray through a bounding box, accumulating density around the beam axis.',
  props: {
    drawCalls: 1,
    geometry: '1 box (36 verts)',
    depth: 'true volume, view-dependent',
    cost: 'high — 28 steps/fragment, early-out',
    fits: 'no',
    why: 'The only technique here whose look depends on the path the ray takes rather than on a surface. That is what makes glow wrap and thicken toward the camera — and it is why it cannot be folded into the shared ribbon shader. This is the case that breaks the one-engine bet.',
  },
};

const VERT = /* glsl */`
varying vec3 vLocalPos;
void main(){
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
#include <common>
${NOISE_GLSL}
uniform vec3  uGlowColor, uCoreColor;
uniform float uGlowIntensity, uCoreIntensity, uCoreWidth, uGlowWidth;
uniform float uScrollSpeed, uNoiseAmount, uTime, uAlpha, uLength;
uniform vec3  uBoxHalf;
uniform mat4  uInvModel;
varying vec3 vLocalPos;

const int STEPS = 28;

// Distance from a point to the beam axis, which runs along local X in
// [-uLength/2, +uLength/2].
float distToAxis(vec3 p, out float along){
  // NB: 'half' is a reserved word in GLSL ES — naming it that silently
  // breaks the program (links, then errors 1282 at draw time).
  float halfLen = uLength * 0.5;
  float x = clamp(p.x, -halfLen, halfLen);
  along = (x + halfLen) / uLength;
  return length(p.yz) + abs(p.x - x);
}

void main(){
  // Ray in local space: from the camera to this fragment.
  vec3 camLocal = (uInvModel * vec4(cameraPosition, 1.0)).xyz;
  vec3 dir = normalize(vLocalPos - camLocal);

  // Slab intersection against the bounding box gives the march interval.
  vec3 inv = 1.0 / dir;
  vec3 t0 = (-uBoxHalf - camLocal) * inv;
  vec3 t1 = ( uBoxHalf - camLocal) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tEnter = max(max(tmin.x, tmin.y), tmin.z);
  float tExit  = min(min(tmax.x, tmax.y), tmax.z);
  tEnter = max(tEnter, 0.0);
  if (tExit <= tEnter) discard;

  // Analytic early-out. The beam axis is the local X axis, so the distance
  // from this view ray to it is closed-form. Most fragments in the bounding
  // box never pass near the beam; marching 28 steps to accumulate nothing is
  // the single biggest waste in a naive volumetric.
  float denom = sqrt(dir.y * dir.y + dir.z * dir.z);
  if (denom > 1e-5){
    float rayDist = abs(camLocal.y * dir.z - camLocal.z * dir.y) / denom;
    if (rayDist > uGlowWidth * 3.5) discard;
  }

  float dt = (tExit - tEnter) / float(STEPS);
  vec3 acc = vec3(0.0);

  for (int i = 0; i < STEPS; i++){
    vec3 p = camLocal + dir * (tEnter + dt * (float(i) + 0.5));
    float along;
    float d = distToAxis(p, along);

    // Soft radial density, plus a much tighter core.
    float g = exp(-pow(d / max(uGlowWidth, 1e-3), 2.0) * 2.5);
    float c = exp(-pow(d / max(uCoreWidth, 1e-3), 2.0) * 2.5);

    float n = fbm(vec2(along * 7.0 - uTime * uScrollSpeed, d * 4.0));
    g *= mix(1.0, n * 1.7, uNoiseAmount);

    float caps = smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.9, 1.0, along));
    acc += (uGlowColor * g * uGlowIntensity + uCoreColor * c * uCoreIntensity) * caps * dt;
  }

  gl_FragColor = vec4(acc * uAlpha * 1.6, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function create({ start, end }){
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const pad = 1.2;

  const uniforms = {
    uGlowColor:{value:new THREE.Color('#ff2a1a')}, uCoreColor:{value:new THREE.Color('#fff')},
    uGlowIntensity:{value:1.5}, uCoreIntensity:{value:3}, uCoreWidth:{value:0.05},
    uGlowWidth:{value:0.3}, uScrollSpeed:{value:2.6}, uNoiseAmount:{value:0.35},
    uTime:{value:0}, uAlpha:{value:1}, uLength:{value:len},
    uBoxHalf:{value:new THREE.Vector3(len/2, pad, pad)},
    uInvModel:{value:new THREE.Matrix4()},
  };

  const geo = new THREE.BoxGeometry(len, pad*2, pad*2);
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide, // march from the far wall so the camera can sit inside
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
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
      mesh.updateMatrixWorld();
      uniforms.uInvModel.value.copy(mesh.matrixWorld).invert();
    },
    dispose(){ geo.dispose(); mat.dispose(); },
  };
}
