import * as THREE from 'three';
import { Rig } from './engine/rig.js';
import { BeamMesh } from './engine/beam.js';
import { burstEnvelope } from './engine/lifecycle.js';
import { currentView } from './router.js';
import { buildJson, buildModule, buildRecipe, download } from './export/method.js';

/**
 * Spike control spec. This is the seed of what becomes engine/params.js —
 * the single source of truth that the panel, the JSON export and the
 * deeplink all read from.
 */
const SPEC = [
  ['core', [
    ['coreColor',     'color',  '#ffffff'],
    ['coreWidth',     'range',  0.045, 0.004, 0.30, 0.001],
    ['coreIntensity', 'range',  3.0,   0.0,   8.0,  0.05],
  ]],
  ['glow', [
    ['glowColor',     'color',  '#ff2a1a'],
    ['glowWidth',     'range',  0.34,  0.02,  1.20, 0.005],
    ['glowIntensity', 'range',  1.5,   0.0,   6.0,  0.05],
    ['glowFalloff',   'range',  2.4,   0.5,   8.0,  0.05],
  ]],
  ['caps', [
    ['capStart',      'range',  0.04,  0.0,   0.40, 0.005],
    ['capEnd',        'range',  0.10,  0.0,   0.40, 0.005],
    ['blast',         'range',  1.2,   0.0,   6.0,  0.05],
  ]],
  ['interference', [
    ['scrollSpeed',   'range',  2.6,  -8.0,   8.0,  0.05],
    ['noiseScale',    'range',  7.0,   0.5,  40.0,  0.1],
    ['noiseAmount',   'range',  0.35,  0.0,   1.0,  0.01],
    ['flicker',       'range',  0.10,  0.0,   1.0,  0.01],
  ]],
  ['instability', [
    ['jitterAmount',  'range',  0.015, 0.0,   0.40, 0.001],
    ['jitterFreq',    'range',  40.0,  1.0, 200.0,  1],
  ]],
  ['burst', [
    ['burstRate',     'range',  3.0,   0.0,  20.0,  0.1],
    ['burstDuty',     'range',  0.35,  0.02,  1.0,  0.01],
    ['burstDecay',    'range',  2.0,   0.25,  6.0,  0.05],
    ['burstAttack',   'range',  0.06,  0.0,   0.6,  0.005],
  ]],
  ['scene', [
    ['bgBrightness',  'range',  0.03,  0.0,   0.55, 0.005],
    ['exposure',      'range',  1.0,   0.1,   3.0,  0.01],
  ]],
];

const defaults = {};
for (const [, rows] of SPEC) for (const [key, , def] of rows) defaults[key] = def;

const state = { ...defaults };

// --- scene -------------------------------------------------------------
const rig = new Rig(document.getElementById('stage'));
const beam = new BeamMesh(rig.start, rig.end);
rig.scene.add(beam.mesh);

function apply(key, value){
  state[key] = value;
  if (key === 'bgBrightness') return rig.setBackground(value);
  if (key === 'exposure')     return rig.setExposure(value);
  beam.set(key, value);
}

// --- panel --------------------------------------------------------------
const controls = document.getElementById('controls');

function buildPanel(){
  controls.innerHTML = '';
  for (const [groupName, rows] of SPEC){
    const g = document.createElement('section');
    g.className = 'group';
    g.innerHTML = `<h2>${groupName}</h2>`;

    for (const [key, kind, def, min, max, step] of rows){
      const row = document.createElement('div');
      row.className = 'row';

      const label = document.createElement('label');
      label.textContent = key.replace(/^(core|glow|noise|jitter|bg)/, '').replace(/^./, c => c.toLowerCase()) || key;
      label.htmlFor = key;
      row.appendChild(label);

      if (kind === 'color'){
        const input = document.createElement('input');
        input.type = 'color'; input.id = key; input.value = state[key];
        input.addEventListener('input', () => apply(key, input.value));
        row.appendChild(input);
        row.appendChild(document.createElement('output'));
      } else {
        const input = document.createElement('input');
        input.type = 'range'; input.id = key;
        input.min = min; input.max = max; input.step = step; input.value = state[key];
        const out = document.createElement('output');
        out.textContent = Number(state[key]).toFixed(step < 0.01 ? 3 : 2);
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          out.textContent = v.toFixed(step < 0.01 ? 3 : 2);
          apply(key, v);
        });
        row.appendChild(input);
        row.appendChild(out);
      }
      g.appendChild(row);
    }
    controls.appendChild(g);
  }
}

buildPanel();
for (const key of Object.keys(state)) apply(key, state[key]);

document.getElementById('reset').addEventListener('click', () => {
  Object.assign(state, defaults);
  buildPanel();
  for (const key of Object.keys(state)) apply(key, state[key]);
});

// --- export -------------------------------------------------------------
// Exports carry the method, not only the numbers: parameters, a drop-in
// module, and the technique written out.
const presetName = () => 'beam-' + new Date().toISOString().slice(0, 10);

const EXPORTS = {
  'exp-json': () => [`${presetName()}.json`, buildJson(state, presetName()), 'application/json'],
  'exp-js':   () => [`${presetName()}.beam.js`, buildModule(state, presetName()), 'text/javascript'],
  'exp-md':   () => [`${presetName()}.recipe.md`, buildRecipe(state, presetName()), 'text/markdown'],
};

for (const [id, make] of Object.entries(EXPORTS)){
  document.getElementById(id).addEventListener('click', () => download(...make()));
}
document.getElementById('exp-all').addEventListener('click', () => {
  // Staggered: browsers drop rapid-fire programmatic downloads.
  Object.values(EXPORTS).forEach((make, i) => setTimeout(() => download(...make()), i * 250));
});

// --- loop ---------------------------------------------------------------
const clock = new THREE.Clock();
function tick(){
  requestAnimationFrame(tick);
  if (currentView() !== 'lab') return; // don't animate a hidden context
  const t = clock.getElapsedTime();
  beam.update(t);
  // burstRate 0 => envelope returns 1 => continuous fire, as before.
  beam.set('alpha', burstEnvelope(t, state));
  rig.render();
}
tick();
