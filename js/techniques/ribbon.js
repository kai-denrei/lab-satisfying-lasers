import * as THREE from 'three';
import { BeamMesh } from '../engine/beam.js';

export const meta = {
  id: 'ribbon',
  name: 'Camera-facing ribbon',
  blurb: 'One quad strip billboarded per-vertex toward the camera. What the Lab tab uses.',
  props: {
    drawCalls: 1,
    geometry: '~386 verts',
    depth: 'flat — no thickness',
    cost: 'very low',
    fits: 'yes',
    why: 'The baseline. Cheap and sharp, but it is a flat sheet: it has no real volume, so it cannot intersect world geometry convincingly and its silhouette is a lie the billboarding hides.',
  },
};

export function create({ start, end }){
  const beam = new BeamMesh(start, end);
  return {
    object: beam.mesh,
    update(t, p){
      beam.update(t);
      for (const k of ['glowColor','coreColor','glowWidth','coreWidth','glowIntensity','coreIntensity','scrollSpeed','noiseAmount','alpha']){
        beam.set(k, p[k]);
      }
    },
    dispose(){ beam.mesh.geometry.dispose(); beam.material.dispose(); },
  };
}
