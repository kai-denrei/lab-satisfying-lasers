# lab-satisfying-lasers

A study lab for laser and beam FX — built to be harvested. Effects developed
here are meant to be lifted into other projects: tank beams, straight lasers,
hot plasma lances, pixel-art rasters.

Browser-native and dependency-free: three.js (vendored), native ES modules, no
bundler, no build step, **no texture assets**. Every effect is a shader plus a
set of numbers, which is what lets a preset travel as plain JSON.

## Run

```sh
npm run serve      # python3 -m http.server 8081
open http://localhost:8081
```

Nothing to install.

## Test

```sh
npm test           # node unit tests
```

Plus `/tests/export-check.html` in a browser, which takes a *generated* export,
imports it, renders it through a real WebGL context and checks `glGetError`.

## Export carries the method

Numbers alone don't reproduce an effect, so every export emits three artifacts:

| file | what it is |
|---|---|
| `.json` | the parameters |
| `.beam.js` | self-contained drop-in module — three.js the only import |
| `.recipe.md` | the technique written out, with these numbers in it |

```js
import { createBeam } from './beam-2026-09-01.beam.js';
const laser = createBeam(start, end, { glowColor: '#22ddff' });
scene.add(laser.mesh);
// in your loop:
laser.update(clock.getElapsedTime());
```

## Status

Early. The beam engine and export pipeline work; the two-tab app shell, preset
catalogue, impact/dust/bloom and the study taxonomy are not built yet.

**[DEVLOG.md](DEVLOG.md)** has the architecture, the method, the roadmap and
the decision log.

## Credits

Technique derives from the 2011 jvm-gaming LibGDX "Laser FX" write-up (layer
structure, additive blending, the `1 - (t/T)²` decay curve) and the ModDB
*Deep Space Exploitation* pixel-art laser breakdown. Sources collected in
[`perplexityOnLasersFX.md`](perplexityOnLasersFX.md).

three.js is MIT licensed, vendored under `vendor/three/`.
