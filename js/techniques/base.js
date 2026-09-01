/** Shared GLSL. Kept in one place so every technique is compared on the same
 *  noise, not on incidental differences between hand-rolled hashes. */
export const NOISE_GLSL = /* glsl */`
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
`;

/** Every technique receives exactly these, so the comparison is fair. */
export const SHARED_DEFAULTS = {
  glowColor: '#ff2a1a',
  coreColor: '#ffffff',
  glowWidth: 0.30,
  coreWidth: 0.05,
  glowIntensity: 1.5,
  coreIntensity: 3.0,
  scrollSpeed: 2.6,
  noiseAmount: 0.35,
  alpha: 1.0,
};
