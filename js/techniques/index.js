import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { currentView, onViewChange } from '../router.js';
import { burstEnvelope } from '../engine/lifecycle.js';
import { SHARED_DEFAULTS } from './base.js';

import * as ribbon from './ribbon.js';
import * as tube from './tube.js';
import * as volumetric from './volumetric.js';
import * as chain from './chain.js';
import * as raster from './raster.js';

const MODULES = [ribbon, tube, volumetric, chain, raster];

const PANEL_W = 300;
const START = new THREE.Vector3(-2.2, 0, 0);
const END   = new THREE.Vector3( 2.2, 0, 0);

const params = { ...SHARED_DEFAULTS, burstRate: 0, burstDuty: 0.35, showOccluder: true };

let mounted = false;
let renderer, master, controls, tiles = [], clock, raf = null;

/** Each technique gets its own scene so nothing bleeds between tiles. */
function makeTile(mod){
  const scene = new THREE.Scene();
  const inst = mod.create({ start: START, end: END });
  scene.add(inst.object);

  // An opaque slab across the beam. Flat techniques cut against it; the tube
  // and the volume pass through it with visible thickness.
  const occluder = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 2.6, 2.6),
    new THREE.MeshBasicMaterial({ color: 0x2a3142 })
  );
  occluder.position.set(0.7, 0, 0);
  scene.add(occluder);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  return { mod, inst, scene, camera, occluder, rect: [0,0,1,1] };
}

function layout(){
  const w = innerWidth - PANEL_W, h = innerHeight - 44; // minus tab bar
  renderer.setSize(w, h, false);

  const cols = w >= 1000 ? 3 : w >= 620 ? 2 : 1;
  const rows = Math.ceil(tiles.length / cols);
  const tw = Math.floor(w / cols), th = Math.floor(h / rows);

  frameToFit(tw / th);

  const labels = document.getElementById('tq-labels');
  labels.style.width = w + 'px';
  labels.style.height = h + 'px';

  tiles.forEach((t, i) => {
    const cx = i % cols, cy = Math.floor(i / cols);
    // WebGL viewport origin is bottom-left; the DOM's is top-left.
    t.rect = [cx * tw, h - (cy + 1) * th, tw, th];
    t.camera.aspect = tw / th;
    t.camera.updateProjectionMatrix();

    const el = t.labelEl;
    el.style.left = (cx * tw) + 'px';
    el.style.top  = (cy * th) + 'px';
    el.style.width = tw + 'px';
  });
}

/**
 * Tiles are usually portrait, so the horizontal field is the binding
 * constraint — fitting to the vertical fov alone lets the beam run off the
 * sides. Distance only; the orbit angle the user set is preserved.
 */
const _dir = new THREE.Vector3();
function frameToFit(aspect){
  const vFov = THREE.MathUtils.degToRad(master.fov);
  const halfLen = (END.x - START.x) * 0.5 * 1.35;  // beam + margin
  const halfH = 1.35;                              // occluder slab height
  const d = Math.max(halfLen / (Math.tan(vFov / 2) * aspect),
                     halfH   /  Math.tan(vFov / 2));
  _dir.subVectors(master.position, controls.target);
  if (_dir.lengthSq() < 1e-6) _dir.set(0.05, 0.28, 1);
  _dir.normalize();
  master.position.copy(controls.target).addScaledVector(_dir, d);
  controls.update();
}

function buildLabels(){
  const wrap = document.getElementById('tq-labels');
  wrap.innerHTML = '';
  tiles.forEach((t) => {
    const el = document.createElement('div');
    el.className = 'tq-label';
    el.innerHTML = `<b>${t.mod.meta.name}</b><span>${t.mod.meta.props.cost} · ${t.mod.meta.props.depth}</span>`;
    el.addEventListener('click', () => select(t.mod.meta.id));
    wrap.appendChild(el);
    t.labelEl = el;
  });
}

function select(id){
  const m = MODULES.find(x => x.meta.id === id).meta;
  document.getElementById('tq-detail').innerHTML = `
    <h3>${m.name}</h3>
    <p class="blurb">${m.blurb}</p>
    <dl>
      <dt>draw calls</dt><dd>${m.props.drawCalls}</dd>
      <dt>geometry</dt><dd>${m.props.geometry}</dd>
      <dt>depth</dt><dd>${m.props.depth}</dd>
      <dt>cost</dt><dd>${m.props.cost}</dd>
      <dt>fits one engine</dt><dd class="fit-${m.props.fits}">${m.props.fits}</dd>
    </dl>
    <p class="why">${m.props.why}</p>`;
  for (const t of tiles) t.labelEl.classList.toggle('sel', t.mod.meta.id === id);
}

function buildPanel(){
  const SPEC = [
    ['glowColor', 'color'], ['coreColor', 'color'],
    ['glowWidth', 0.05, 0.9, 0.005], ['coreWidth', 0.005, 0.3, 0.001],
    ['glowIntensity', 0, 5, 0.05], ['coreIntensity', 0, 8, 0.05],
    ['scrollSpeed', -8, 8, 0.05], ['noiseAmount', 0, 1, 0.01],
    ['burstRate', 0, 20, 0.1], ['burstDuty', 0.02, 1, 0.01],
  ];
  const host = document.getElementById('tq-controls');
  host.innerHTML = '<h2>shared inputs</h2><p class="hint-sm">every technique gets the same values, so the comparison is fair</p>';
  for (const [key, a, b, step] of SPEC){
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('label');
    label.textContent = key;
    row.appendChild(label);
    if (a === 'color'){
      const inp = document.createElement('input');
      inp.type = 'color'; inp.value = params[key];
      inp.addEventListener('input', () => { params[key] = inp.value; });
      row.appendChild(inp); row.appendChild(document.createElement('output'));
    } else {
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = a; inp.max = b; inp.step = step; inp.value = params[key];
      const out = document.createElement('output');
      out.textContent = Number(params[key]).toFixed(step < 0.01 ? 3 : 2);
      inp.addEventListener('input', () => {
        params[key] = parseFloat(inp.value);
        out.textContent = params[key].toFixed(step < 0.01 ? 3 : 2);
      });
      row.appendChild(inp); row.appendChild(out);
    }
    host.appendChild(row);
  }

  const occ = document.createElement('label');
  occ.className = 'toggle';
  occ.innerHTML = '<input type="checkbox" checked> show occluder slab';
  occ.querySelector('input').addEventListener('change', (e) => {
    params.showOccluder = e.target.checked;
    for (const t of tiles) t.occluder.visible = params.showOccluder;
  });
  host.appendChild(occ);
}

function tick(){
  raf = requestAnimationFrame(tick);
  if (currentView() !== 'techniques') return;

  const t = clock.getElapsedTime();
  params.alpha = burstEnvelope(t, params);
  controls.update();

  renderer.setScissorTest(true);
  for (const tile of tiles){
    const [x, y, w, h] = tile.rect;
    if (w <= 0 || h <= 0) continue;
    // One orbit drives every tile, so techniques can be compared from the
    // same angle — including straight down the beam axis, where the flat
    // ones give themselves away.
    tile.camera.position.copy(master.position);
    tile.camera.quaternion.copy(master.quaternion);
    tile.inst.update(t, params);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.render(tile.scene, tile.camera);
  }
  renderer.setScissorTest(false);
}

export function mountTechniques(){
  if (mounted) return;
  mounted = true;

  const canvas = document.getElementById('tq-stage');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05060a, 1);

  master = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  master.position.set(0.4, 2.2, 8.0);
  controls = new OrbitControls(master, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 40;

  tiles = MODULES.map(makeTile);
  buildLabels();
  buildPanel();
  select('ribbon');
  layout();
  addEventListener('resize', layout);

  clock = new THREE.Clock();
  tick();
}

onViewChange((v) => {
  if (v === 'techniques'){ mountTechniques(); layout(); }
});
if (currentView() === 'techniques') mountTechniques();
