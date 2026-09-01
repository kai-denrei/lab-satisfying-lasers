import * as THREE from 'three';

/**
 * BeamMesh — a camera-facing ribbon carrying the whole laser in one shader.
 *
 * The jvm-gaming recipe builds this from 7 sprites (start/mid/end x glow/core).
 * We do the same layering analytically in beam-space UVs instead, so a preset
 * stays pure JSON with no texture assets to ship beside it.
 *
 *   u  0..1  along the beam, emitter -> target
 *   v -1..1  across the ribbon, +/-1 == glowWidth
 */

export const SEGMENTS = 192;

export const VERT = /* glsl */`
attribute float aU;
attribute float aV;

uniform vec3  uStart;
uniform vec3  uEnd;
uniform float uGlowWidth;
uniform float uJitterAmount;
uniform float uJitterFreq;
uniform float uTime;

varying float vU;
varying float vV;

float h11(float p){ return fract(sin(p * 127.1) * 43758.5453123); }
float n11(float p){
  float i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h11(i), h11(i + 1.0), f);
}

void main(){
  vU = aU;
  vV = aV;

  vec3 dir   = normalize(uEnd - uStart);
  vec3 p     = mix(uStart, uEnd, aU);
  vec3 toCam = normalize(cameraPosition - p);

  // Ribbon always presents its face to the camera.
  vec3 side = normalize(cross(dir, toCam));
  vec3 up   = normalize(cross(side, dir));

  // Instability. Anchored at both ends so the beam stays welded to the
  // nozzle and the impact point however hard it shakes in the middle.
  float anchor = sin(aU * 3.14159265);
  float j1 = n11(aU * uJitterFreq + uTime * 7.0)        - 0.5;
  float j2 = n11(aU * uJitterFreq + 31.7 - uTime * 5.0) - 0.5;
  p += (side * j1 + up * j2) * uJitterAmount * anchor;

  p += side * (aV * uGlowWidth);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const FRAG = /* glsl */`
#include <common>

uniform vec3  uCoreColor;
uniform vec3  uGlowColor;
uniform float uCoreWidth;
uniform float uGlowWidth;
uniform float uCoreIntensity;
uniform float uGlowIntensity;
uniform float uGlowFalloff;
uniform float uCapStart;
uniform float uCapEnd;
uniform float uBlast;
uniform float uScrollSpeed;
uniform float uNoiseScale;
uniform float uNoiseAmount;
uniform float uFlicker;
uniform float uTime;
uniform float uAlpha;

varying float vU;
varying float vV;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main(){
  float av = abs(vV);

  // --- caps: taper the PROFILE, don't just fade it ----------------------
  // Dividing the across-coordinate by the taper shrinks the beam's visible
  // width toward each end, giving a lance tip. Fading alpha alone leaves a
  // guillotined rectangle.
  float capA = smoothstep(0.0, max(uCapStart, 1e-4), vU);
  float capB = 1.0 - smoothstep(1.0 - max(uCapEnd, 1e-4), 1.0, vU);
  float taper = min(capA, capB);
  float avT = av / max(taper, 1e-3);

  // --- across-profile layers -------------------------------------------
  float glow = pow(max(0.0, 1.0 - avT), uGlowFalloff);

  float ch   = clamp(uCoreWidth / max(uGlowWidth, 1e-4), 0.0, 1.0);
  float core = 1.0 - smoothstep(ch * 0.35, ch, avT);

  float lenMask = mix(0.55, 1.0, taper);

  // Nozzle blast: a hot bloom of glow riding on the first few percent.
  // Needs its own across-profile, otherwise it paints the full ribbon width
  // and the beam starts as a rectangle instead of a cap.
  float blastProfile = pow(max(0.0, 1.0 - av), 1.4);
  float blast = exp(-vU * 22.0) * uBlast * blastProfile;

  // --- interference ------------------------------------------------------
  float n = fbm(vec2(vU * uNoiseScale - uTime * uScrollSpeed, vV * 1.5 + 4.0));
  float interf = mix(1.0, n * 1.7, uNoiseAmount);

  float flick = 1.0 - uFlicker * vnoise(vec2(uTime * 11.0, 0.0));

  vec3 col = uGlowColor * glow * uGlowIntensity * interf
           + uCoreColor * core * uCoreIntensity;
  col += uGlowColor * blast;
  col *= lenMask * flick * uAlpha;

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function buildGeometry(){
  const vertCount = (SEGMENTS + 1) * 2;
  const position = new Float32Array(vertCount * 3); // written by the vertex shader
  const aU = new Float32Array(vertCount);
  const aV = new Float32Array(vertCount);
  const index = new Uint16Array(SEGMENTS * 6);

  for (let i = 0; i <= SEGMENTS; i++){
    const u = i / SEGMENTS;
    aU[i * 2] = u;      aV[i * 2] = -1;
    aU[i * 2 + 1] = u;  aV[i * 2 + 1] = 1;
  }
  for (let i = 0; i < SEGMENTS; i++){
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    index.set([a, c, b, b, c, d], i * 6);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  g.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

export class BeamMesh {
  constructor(start, end){
    this.uniforms = {
      uStart:        { value: start.clone() },
      uEnd:          { value: end.clone() },
      uTime:         { value: 0 },
      uAlpha:        { value: 1 },
      uCoreColor:    { value: new THREE.Color('#ffffff') },
      uGlowColor:    { value: new THREE.Color('#ff2a1a') },
      uCoreWidth:    { value: 0.045 },
      uGlowWidth:    { value: 0.34 },
      uCoreIntensity:{ value: 3.0 },
      uGlowIntensity:{ value: 1.5 },
      uGlowFalloff:  { value: 2.4 },
      uCapStart:     { value: 0.04 },
      uCapEnd:       { value: 0.10 },
      uBlast:        { value: 1.2 },
      uScrollSpeed:  { value: 2.6 },
      uNoiseScale:   { value: 7.0 },
      uNoiseAmount:  { value: 0.35 },
      uJitterAmount: { value: 0.015 },
      uJitterFreq:   { value: 40.0 },
      uFlicker:      { value: 0.10 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending, // glBlendFunc(GL_SRC_ALPHA, GL_ONE)
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: true,
    });

    this.mesh = new THREE.Mesh(buildGeometry(), this.material);
    this.mesh.frustumCulled = false; // positions live in the vertex shader
    this.mesh.renderOrder = 10;
  }

  /** Accepts the flat key/value shape the panel emits. */
  set(key, value){
    const u = this.uniforms['u' + key[0].toUpperCase() + key.slice(1)];
    if (!u) return false;
    if (u.value && u.value.isColor) u.value.set(value);
    else u.value = value;
    return true;
  }

  setEndpoints(start, end){
    this.uniforms.uStart.value.copy(start);
    this.uniforms.uEnd.value.copy(end);
  }

  update(elapsed){
    this.uniforms.uTime.value = elapsed;
  }
}
