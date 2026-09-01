# lab-satisfying-lasers — DEV log

A study lab for laser / beam FX, built to be harvested. Effects developed here
are meant to be lifted into other projects: tank beams, straight lasers, hot
plasma lances, pixel-art rasters.

Two halves:

- **Study** — a reference taxonomy of how lasers are done in games, with a live
  approximation of each archetype.
- **Lab** — the same engine driven by editable presets, each deeplinkable and
  exportable.

---

## 1. For devs

### Stack

| | |
|---|---|
| Rendering | three.js **r180**, vendored at `vendor/three/` |
| Modules | native ESM + `<script type="importmap">`. No bundler, no build step. |
| Runtime deps | **zero**. `package.json` is dev tooling only; nothing to install. |
| Assets | **none**. Every effect is procedural — shaders and numbers, no textures. |
| Server | any static server. `npm run serve` → `http://localhost:8081` |
| Tests | `npm test` (node, pure modules) + `/tests/export-check.html` (in-browser) |
| Cache busting | `npm run bust` — `?v=` fingerprinting + shape-favicon badge |

The zero-asset rule is load-bearing, not aesthetic: it's what lets a preset be
*just JSON* and travel to another project without a texture folder trailing it.

### Run it

```sh
npm run serve        # python3 -m http.server 8081
open http://localhost:8081
```

Port 8081 rather than 8080 — 8080 is usually occupied on this machine.

### Layout

```
index.html            app shell + import map
css/app.css
js/
  main.js             control spec, panel, wiring, loop
  engine/
    rig.js            scene, camera, ground, emitter, target
    beam.js           ribbon geometry + the beam shader
    lifecycle.js      burst envelope — pure maths, no three.js
  export/
    method.js         json / drop-in module / recipe generators
tests/
  lifecycle.test.js   node unit tests for the burst envelope
  export-check.html   in-browser validation of generated artifacts
vendor/three/         three r180 + OrbitControls
```

### Architecture, in one paragraph

`rig.js` owns the stage and knows nothing about beams. `beam.js` owns one
camera-facing ribbon and knows nothing about the stage — it takes two world
points and a bag of parameters. `main.js` holds the parameter spec and wires
the two together. That spec is the seam everything else hangs off: the control
panel is generated from it, exports are generated from it, and deeplinks will
diff against it. Adding a parameter should be a one-line change there plus a
uniform in the shader.

### The method

The short version: one camera-facing quad strip from emitter to target, with
`u` running along the beam and `v` across it. Glow, core, caps, nozzle blast and
scrolling interference are all derived analytically from those two coordinates
in a single fragment shader, composited additively.

This is a re-derivation of the canonical 7-sprite recipe (start/mid/end caps ×
glow/core, from the 2011 jvm-gaming write-up) with the sprites replaced by
math. Full detail — including the vertex billboarding, the cap-taper trick and
the noise setup — is written out in the `.recipe.md` that every export emits.
That file is generated from live values, so it never drifts from the code.

### Conventions

- Comments explain *why*, especially where a shader line is non-obvious.
- Shader source lives in tagged `/* glsl */` template literals so editors
  highlight it.
- Anything that renders gets verified by actually rendering it, not by reading
  the diff. `tests/export-check.html` runs the generated module through a real
  WebGL context and checks `glGetError`.

---

## 2. Export — the method, not just the numbers

Numbers alone don't reproduce an effect. Every export emits three artifacts:

| file | what it is | for |
|---|---|---|
| `<name>.json` | parameters, split into `beam` and `scene` | reloading a preset; feeding a pipeline |
| `<name>.beam.js` | self-contained ES module, three.js the only import | dropping straight into another project |
| `<name>.recipe.md` | the technique in prose, with these numbers in it | rebuilding it in another engine, or by hand |

The `.beam.js` is genuinely standalone — shaders inlined, parameters baked as
`DEFAULTS`, overridable per call:

```js
import { createBeam } from './beam-2026-09-01.beam.js';
const laser = createBeam(start, end, { glowColor: '#22ddff' });
scene.add(laser.mesh);
// in your loop:
laser.update(clock.getElapsedTime());
```

---

## 3. Roadmap

**Now — beam spike** ✅
Neutral rig, ribbon shader (glow · core · caps · blast · interference ·
jitter), burst firing, 20 live parameters, three-artifact export.

**Bursts** ✅
`burstRate` sets the blasting speed in shots per second; `burstDuty` sets how
much of each cycle is firing; `burstDecay` and `burstAttack` shape the shot.
`burstRate: 0` gives an uninterrupted beam. Lives in `lifecycle.js` as pure
maths, so it unit-tests in node and is embedded verbatim into every export.

**Next — engine completion**
- [ ] `params.js` — promote the spec in `main.js` to the real schema module
      (types, ranges, defaults, validate, merge). Everything else reads from it.
- [ ] `lifecycle.js` — extend the burst envelope into the full state machine:
      `idle → charge → fire → decay`, with a charge-up windup before each shot.
      Three modes: `sustained` (cutting beam), `pulse` (charged railgun),
      `bolt` (travelling projectile). Burst covers the `pulse` case already.
- [ ] `impact.js` — hit flash, spark burst, accumulating scorch on the target.
- [ ] `dust.js` — point volume lit by distance-to-beam, computed in the vertex
      shader so it costs nothing on the CPU.
- [ ] `post.js` — EffectComposer + UnrealBloom. Needs three's post-processing
      addons vendored, which aren't present yet.

**Then — app shell**
- [ ] Two tabs: Study and Lab, hash-routed.
- [ ] Preset catalogue (~8): crimson cutter, plasma lance, tank railgun,
      blaster bolt, ion thread, disintegrator, frost lance, pixel raster.
- [ ] Deeplinks — `#/lab?fx=<id>` for a clean preset, plus an encoded diff for
      an edited one so a tweak can be shared as a URL.
- [ ] Study taxonomy cards with live mini-previews and "open in lab →".
      **One shared renderer** drawing into per-card 2D canvases via
      `drawImage`, gated by IntersectionObserver — not N WebGL contexts.

**Then — infrastructure**
- [x] `/cache-busting` — `scripts/bust.sh`, `?v=` fingerprinting, anti-cache
      meta tags, shape-favicon + corner badge. `npm run bust` bumps the token
      everywhere; `npm run watch` re-bumps on save.
      Badge assets live in `public/` and are referenced **relatively**
      (`./public/cb-shapes/NN.svg`) — root-absolute paths 404 both here (the
      repo root is the web root, not `public/`) and under the Pages subpath.
- [x] `/deban` — decision log at `.deban/`, six roles, solo mode.
      Gitignored: it is private working memory, not a published artifact.
- [ ] Node tests for the pure modules (params, deeplink, exporter).

**Maybe — not committed**
- Beam reflection / multi-segment raycasting.
- Occlusion and beam-lit scene geometry.
- Audio coupling. The sources are unanimous that sound carries much of the
  perceived impact, but it widens the project a long way.

---

## 4. Decisions & findings

**2026-09-01 — kickoff**

Design settled on four choices: presets over one shared engine (not one module
per effect); a neutral test rig (not per-preset stages); a full parameter panel
(not fixed exhibits); study-as-taxonomy-cards with live previews.

Built the beam spike first, ahead of the scaffolding, to check the shader had
the right character before building infrastructure around it.

Three bugs worth remembering, all found by rendering rather than by reading:

1. **Caps must taper the profile, not the alpha.** Fading alpha along the
   length leaves a guillotined rectangle. Dividing the across-coordinate by the
   taper (`v / max(taper, 1e-3)`) pinches the beam to a point instead.
2. **The nozzle blast needs its own across-profile.** Without one it paints the
   full ribbon width and the beam starts as a solid rectangle.
3. **`Color.setHSL()` defaults to the linear working space.** A requested
   lightness of `0.03` rendered as a washed-out `~0.19`. Pass
   `THREE.SRGBColorSpace` explicitly.

Also: the control panel overlays the right edge, so `camera.setViewOffset()`
shifts the frustum to centre the stage in the *visible* region rather than the
canvas.

**Bursts.** Added `lifecycle.js`. Kept it as pure maths with no three.js
import for two reasons: it unit-tests in node without a browser, and
`buildModule()` can embed `burstEnvelope.toString()` directly, so the exported
module can never drift from the behaviour tuned in the lab.

A square on/off reads as a strobe, not as gunfire. What sells it is the shaping
inside each shot — a fast attack (`smoothstep(0, attack, x)`) against the
`1 - x^decay` falloff the LibGDX write-up specifies. Time keeps running through
the gaps, so interference noise lands differently on every shot and no two
blasts look alike.

Burst parameters are deliberately *not* shader uniforms. They drive alpha on
the CPU, one value per frame, which keeps the shader untouched and means the
envelope is testable without a GL context.

Open question: default `noiseAmount` of 0.35 reads subtle — closer to a clean
tube than to hot plasma. Needs a pass over defaults once bloom exists, since
bloom will change what the right values are.

### Reference

Sources behind the technique are collected in `perplexityOnLasersFX.md`. The
2011 jvm-gaming LibGDX write-up is the most directly useful (layer structure,
additive blending, the `1 - (t/T)²` decay curve); the ModDB Deep Space
Exploitation piece covers the raster/pixel-art case.
