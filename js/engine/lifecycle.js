/**
 * Beam lifecycle. Pure maths, no three.js, no DOM — so it unit-tests in node
 * and can be embedded verbatim into exported modules.
 */

export function smoothstep(edge0, edge1, x){
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Repeating burst envelope — "someone blasting".
 *
 * Returns the beam's alpha at `time`, in 0..1.
 *
 *   burstRate    bursts per second. 0 = continuous fire (envelope disabled).
 *   burstDuty    fraction of each cycle spent firing; the rest is the gap.
 *   burstDecay   exponent of the falloff within a shot. The 2011 LibGDX
 *                write-up uses alpha = 1 - (t/T)^2; an exponent reads as
 *                afterglow where a linear ramp reads as a dimmer switch.
 *   burstAttack  rise time as a fraction of the shot. Keep it small — the
 *                snap on the leading edge is most of why a blast feels sharp.
 *
 * A square on/off would read as a strobe. The attack/decay shaping is what
 * makes it read as discharges.
 */
export function burstEnvelope(time, params){
  const p = params || {};
  const rate = p.burstRate || 0;
  if (!(rate > 0)) return 1; // continuous

  const duty   = Math.min(1, Math.max(0.001, p.burstDuty  === undefined ? 0.35 : p.burstDuty));
  const decay  = p.burstDecay  === undefined ? 2   : p.burstDecay;
  const attack = p.burstAttack === undefined ? 0.06 : p.burstAttack;

  const phase = (time * rate) % 1;
  if (phase >= duty) return 0; // between shots

  const t = phase / duty; // 0..1 across one shot
  const rise = attack > 0 ? smoothstep(0, attack, t) : 1;
  const fall = 1 - Math.pow(t, decay);
  return Math.max(0, rise * fall);
}
