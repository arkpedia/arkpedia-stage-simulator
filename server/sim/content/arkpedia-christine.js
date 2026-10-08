// SPDX-License-Identifier: GPL-3.0-or-later
// Source graphs and explicit native dispatch boundaries: arkpedia-christine-prefabs.json.
import evidence from '../../../data/arkpedia-christine-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_4198_christ', RELEASE = .2666670083999634, END = .16666699945926666;
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const plain = { attack: 'ranged', dmgType: 'arts', projectile: 'none', heal: null,
  canHitFly: true, maxTargets: 1, allInRange: false, rangeAoe: false,
  hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null };
function select(b, u, p = plain) {
  return acquireTargets(b, u, { ...p, acquireTargets: null });
}
function hpElement(b, u, e, ratio, info, tag) {
  b.dealDamage(u, e, { amount: u.s.atk * ratio, type: 'elemental',
    isAttack: true, isSkill: !!info.isSkill, isProjectile: !!info.isProjectile,
    attackId: info.attackId, applyWay: 'none', canDodge: false, tags: [tag] });
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const ratio = p.christineOne ? u.skill.bb['attack@ep_damage_ratio'] : 0;
  b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      let hook, observed = false;
      if (ratio > 0) hook = b.on('damaged', ctx => {
        if (observed || ctx.source !== u || ctx.target !== e || ctx.type !== 'arts'
          || ctx.dmg?.attackId !== info.attackId || !ctx.dmg.tags.includes('christine:primary')) return;
        observed = true;
        // Exact ActiveEP SANITY/Arts binding. Native RealDamage versus HP-floor
        // loss bookkeeping remains bounded to accepted post-shield amount.
        b.dealDamage(u, e, { amount: ctx.amount * ratio, type: 'element', element: 'neural',
          isAttack: false, isSkill: true, isProjectile: true, attackId: info.attackId,
          canDodge: false, tags: ['christine:s1-injury'] });
      });
      try { resolveHit(b, u, { ...p, ...plain, maxTargets: p.maxTargets,
        tags: ['christine:primary'] }, e, { ...info, isProjectile: true }, e.x, e.y); }
      finally { if (hook) b.off(hook); }
    } });
}
function endCast(b, u, state) {
  if (state.ending) return;
  state.ending = true;
  const attached = () => u.alive && u.deployed && u.mem.christineCast === state && u.deploySeq === state.seq
    && u.skill.active && u.skill.activations === state.activation;
  if (!attached()) return;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  u.skill.timeLeft = END + b.dt;
  b.after(END, () => { if (attached()) u.skill.end('projectile'); }, { owner: u });
}
function spirit(b, u, state, point, bb) {
  const field = { x: u.x, y: u.y, bornAt: b.time, arrivedAt: null,
    until: Infinity, done: false, projectile: null, radius: bb.projectile_range };
  u.mem.christineFields.push(field);
  const info = { isSkill: true, isProjectile: true, attackId: ++b._attackSeq };
  let period, watcher, expiry;
  const stop = () => {
    if (field.done) return;
    field.done = true; period?.cancel(); watcher?.cancel(); expiry?.cancel();
    b.removeProjectiles(p => p === field.projectile);
    u.mem.christineFields = u.mem.christineFields.filter(x => x !== field);
    endCast(b, u, state);
  };
  const pulse = () => {
    if (field.done || b.time >= field.until - 1e-9) { stop(); return; }
    if (!field.arrivedAt && field.projectile) {
      field.x = field.projectile.x; field.y = field.projectile.y;
    }
    for (const e of b.enemiesInRadius(field.x, field.y, field.radius)) {
      if (!canTargetEnemy(u, e, plain)) continue;
      // Original nonmissable active-buff checks SANITY specifically. Its
      // position relative to primary Arts is explicitly a bounded dispatch law.
      if (e.findBuff('neuralBurst')) hpElement(b, u, e, bb.atk_scale_ep, info, 'christine:s2-recovery');
      if (e.alive) resolveHit(b, u, { ...plain, atkScale: bb.atk_scale,
        tags: ['christine:spirit'] }, e, info, e.x, e.y);
    }
  };
  field.projectile = b.addProjectile({ from: u, to: point, source: u, speed: 8,
    maxAge: 10, visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
      if (field.done) return;
      field.x = x; field.y = y; field.arrivedAt = b.time;
      // Selected projectile_delay_time is the documented after-arrival bridge,
      // not a claim that native raw root life10 has been reverse engineered.
      field.until = b.time + bb.projectile_delay_time;
      if (u.alive && u.deployed && u.mem.christineCast === state) u.skill.timeLeft = bb.projectile_delay_time + END + b.dt;
      expiry = b.after(bb.projectile_delay_time, stop);
    } });
  // Born unmanaged/source-invalid0 effects are deliberately unowned. They do
  // not disappear when the caster retreats or dies, and still observe removal.
  watcher = b.every(b.dt, () => {
    if (field.done) { watcher.cancel(); return; }
    if (field.projectile.removed && field.arrivedAt == null) { stop(); return; }
    if (field.arrivedAt == null) { field.x = field.projectile.x; field.y = field.projectile.y; }
    if (b.time >= field.until - 1e-9) stop();
  });
  period = b.every(bb.interval, pulse); pulse();
}
function start(b, u, def) {
  const state = { seq: u.deploySeq, activation: u.skill.activations, born: false,
    cancelled: false, ending: false };
  u.mem.christineCast = state; u.skill.timeLeft = Infinity;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'christine:mode', flags: { disarm: true } });
  const epoch = u.attackControlEpoch;
  const attached = () => u.alive && u.deployed && u.mem.christineCast === state && u.deploySeq === state.seq
    && u.skill.active && u.skill.activations === state.activation;
  const observer = b.every(b.dt, () => {
    if (!attached() || state.born || state.cancelled) { observer.cancel(); return; }
    if (u.hidden || !u.canAct || u.attackControlEpoch !== epoch) { state.cancelled = true; observer.cancel(); }
  }, { owner: u });
  b.after(RELEASE, () => {
    observer.cancel();
    if (!attached()) return;
    if (state.cancelled || u.hidden || !u.canAct || u.attackControlEpoch !== epoch) { endCast(b, u, state); return; }
    const e = select(b, u)[0];
    if (!e) { endCast(b, u, state); return; }
    state.born = true;
    spirit(b, u, state, { x: Math.round(e.x), y: Math.round(e.y) }, def.skill.bb);
  }, { owner: u });
  b.after(model(u).durations.Skill_2_Begin, () => {
    if (attached() && !state.ending) u.mem.regularFormVisual = {
      clip: ['UP', 'LEFT'].includes(u.dir) ? 'Skill_2_Idle' : 'Skill_2_Loop', loop: true };
  }, { owner: u });
}
export function customizeChristineKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...plain, retargetOnRelease: true, interruptOnSkillChange: true,
    launchAttack: launch, attackVisual: 'Attack',
    windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit) };
  const s = def.skill;
  kit.skill = s.id.endsWith('_1') ? { kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk }, attack: { christineOne: true,
      maxTargets: s.bb['attack@max_target'], attackVisual: 'Skill_1',
      windup: (_b, unit) => model(unit).hits.Skill_1[0] / rate(unit) } }
    : { kind: 'duration', duration: s.duration, attack: { noAttack: true },
      canActivate: () => select(b, u).length > 0, onStart: () => start(b, u, def),
      onEnd: () => { u.mem.christineCast = null; u.mem.regularFormVisual = null;
        b.removeBuff(u, 'christine:mode'); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installChristine({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.christineFields = [];
  const talent = def.talents.find(t => t.bb.atk_scale != null)?.bb;
  if (!talent) return;
  // ON_ABNORMAL_FLAG_DIRTY PALSYING 0→1 bridge is supplied solely at actual
  // successful stack consumption. It deliberately does not filter the producer.
  b.on('palsyTriggered', ({ unit: e }) => {
    if (!live(u) || !e?.alive || !e.deployed || e.hidden || e.s.flags.untargetable
      || !bodyInKeys(e, new Set(u.rangeKeys))) return;
    hpElement(b, u, e, talent.atk_scale,
      { isSkill: false, attackId: ++b._attackSeq }, 'christine:talent');
  }, { owner: u });
}
