import { test } from 'node:test';
import assert from 'node:assert/strict';
import { burstEnvelope, smoothstep } from '../js/engine/lifecycle.js';

const P = { burstRate: 4, burstDuty: 0.5, burstDecay: 2, burstAttack: 0.05 };

test('rate 0 means continuous fire', () => {
  for (const t of [0, 0.3, 7.7, 100]) {
    assert.equal(burstEnvelope(t, { ...P, burstRate: 0 }), 1);
  }
});

test('missing params default to continuous', () => {
  assert.equal(burstEnvelope(1.23, {}), 1);
  assert.equal(burstEnvelope(1.23, undefined), 1);
});

test('output always stays within 0..1', () => {
  for (let i = 0; i < 4000; i++) {
    const a = burstEnvelope(i * 0.0013, P);
    assert.ok(a >= 0 && a <= 1, `alpha ${a} out of range at step ${i}`);
  }
});

test('beam is dark in the gap between shots', () => {
  // duty 0.5 at 4/s: cycle is 0.25s, firing for the first 0.125s.
  assert.equal(burstEnvelope(0.20, P), 0);
  assert.equal(burstEnvelope(0.24, P), 0);
  assert.ok(burstEnvelope(0.05, P) > 0);
});

test('each shot rises then falls', () => {
  const shot = [];
  for (let i = 0; i <= 40; i++) shot.push(burstEnvelope((i / 40) * 0.125, P));
  const peak = shot.indexOf(Math.max(...shot));
  assert.ok(peak > 0 && peak < shot.length - 1, 'peak should be inside the shot');
  assert.ok(shot[0] < 0.2, 'shot starts near dark');
  assert.ok(shot.at(-1) < 0.1, 'shot decays to near dark');
});

test('attack is fast: peak lands early in the shot', () => {
  const N = 200, shot = [];
  for (let i = 0; i < N; i++) shot.push(burstEnvelope((i / N) * 0.125, P));
  const peak = shot.indexOf(Math.max(...shot)) / N;
  assert.ok(peak < 0.35, `peak at ${peak}, expected a snappy leading edge`);
});

test('rate controls blasting speed — shots per second', () => {
  const countShots = (rate) => {
    let shots = 0, prev = 0;
    for (let i = 0; i < 20000; i++) {              // 2 seconds at 0.1ms
      const a = burstEnvelope(i * 0.0001, { ...P, burstRate: rate });
      if (a > 0 && prev === 0) shots++;
      prev = a;
    }
    return shots;
  };
  assert.equal(countShots(2), 4);   // 2/s over 2s
  assert.equal(countShots(5), 10);  // 5/s over 2s
});

test('duty controls how much of the cycle is firing', () => {
  const onFraction = (duty) => {
    let on = 0, n = 20000;
    for (let i = 0; i < n; i++) if (burstEnvelope(i * 0.0001, { ...P, burstDuty: duty }) > 0) on++;
    return on / n;
  };
  assert.ok(Math.abs(onFraction(0.2) - 0.2) < 0.02);
  assert.ok(Math.abs(onFraction(0.8) - 0.8) < 0.02);
});

test('smoothstep clamps and is monotonic', () => {
  assert.equal(smoothstep(0, 1, -5), 0);
  assert.equal(smoothstep(0, 1, 5), 1);
  assert.ok(smoothstep(0, 1, 0.25) < smoothstep(0, 1, 0.75));
});
