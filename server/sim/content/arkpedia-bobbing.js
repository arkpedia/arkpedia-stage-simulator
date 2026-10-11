// SPDX-License-Identifier: GPL-3.0-or-later
// Exact original graphs, transforms and bounded dispatcher interpretations are
// retained in data/arkpedia-bobbing-prefabs.json. No native frame parity claim.
import evidence from '../../../data/arkpedia-bobbing-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { hitRect } from '../body.js';
const ID = 'char_487_bobb';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const ordinary = { attack: 'ranged', dmgType: 'arts', projectile: 'none', heal: null,
  canHitFly: true, maxTargets: 1, allInRange: false, rangeAoe: false,
  hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null };
const ground = { ...ordinary, canHitFly: false, groundOnly: true };
const candidates = (b, u, p) => acquireTargets(b, u, { ...p, acquireTargets: null,
  maxTargets: 10000, allInRange: false });
function select(b, u, p) {
  const all = candidates(b, u, p);
  // Native postFilter57 is bound narrowly to the official selected S1
  // description, not presented as a recovered general selector enum.
  if (p.bobbingSkillOne) all.sort((a, z) => Number(!!a.s.flags.burstLock) - Number(!!z.s.flags.burstLock));
  return all.slice(0, 1);
}
function injury(b, u, e, ratio, info, tag) {
  if (!(ratio > 0) || !e.alive || !e.deployed) return;
  // Source ATK is distinct from the ability's Arts scale and accepted HP loss.
  // Original nodes explicitly do not force a projectile-cached ATK snapshot.
  b.dealDamage(u, e, { amount: u.s.atk * ratio, type: 'element', element: 'burn',
    isAttack: false, isSkill: !!info.isSkill, attackId: info.attackId,
    canDodge: false, tags: [tag] });
}
function firstHit(b, u, e, info) {
  const t = u.def.talents[0]?.bb;
  const ratio = t?.['attack@ep_damage_ratio_talent'] ?? 0;
  if (!(ratio > 0) || !e.alive) return;
  const mark = `bobb_t_1[mark]:${u.id}`;
  if (e.findBuff(mark)) return;
  b.addBuff(e, { key: mark, source: u, refresh: 'keep' });
  const duration = t['attack@dmg_duration'];
  // CreateBuff children are nonderived. Their mark and five-second injury
  // continue independently of owner/ability detachment, with current source ATK.
  const dot = b.addBuff(e, { key: `bobb_t_1[damage]:${u.id}`, source: u, duration,
    refresh: 'keep' });
  // Shared buff ticking admits the expiry-frame tick. Preserve the scoped
  // strict-before-expiry law explicitly rather than adding an unintended sixth
  // injury to the immediate start plus four native one-second periods.
  for (let time = 1; time < duration; time++) b.after(time, () => {
    if (e.findBuff(dot.key) === dot) injury(b, u, e, ratio, info, 'bobbing:talent');
  });
  injury(b, u, e, ratio, info, 'bobbing:talent');
}
function primary(b, u, e, p, info, ratio = 0) {
  if (!canTargetEnemy(u, e, p)) return;
  let observed = false;
  const hook = b.on('damaged', ctx => {
    if (observed || ctx.source !== u || ctx.target !== e || ctx.type !== 'arts'
      || ctx.dmg?.attackId !== info.attackId || !ctx.dmg.isAttack
      || !ctx.dmg.tags?.includes('bobbing:primary')) return;
    observed = true;
    // Bounded accepted-output bridge: fully absorbed Arts is admitted; dodge,
    // cancelled output and pre-pipeline invalid victims are not. Native active
    // buff / elemental / same-hit burst order is explicitly unrecovered.
    firstHit(b, u, e, info);
    injury(b, u, e, ratio, info, 'bobbing:skill-injury');
  });
  try { resolveHit(b, u, { ...p, ...ordinary, atkScale: p.atkScale,
    tags: ['bobbing:primary'] }, e, info, e.x, e.y); }
  finally { b.off(hook); }
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  u.mem.bobbingEmittedAttack = info.attackId;
  const ratio = p.bobbingSkillOne ? u.skill.bb.ep_damage_ratio : 0;
  b.addProjectile({ from: u, target: e, source: u, speed: 8, maxAge: 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target }) => { if (target) primary(b, u, target, p, info, ratio); } });
}
function inField(e, field) {
  const r = hitRect(e), x0 = field.x - field.width / 2, x1 = field.x + field.width / 2,
    y0 = field.y - field.height / 2, y1 = field.y + field.height / 2;
  return r ? r.x1 > x0 + 1e-9 && r.x0 < x1 - 1e-9 && r.y1 > y0 + 1e-9 && r.y0 < y1 - 1e-9
    : e.x >= x0 - 1e-9 && e.x <= x1 + 1e-9 && e.y >= y0 - 1e-9 && e.y <= y1 + 1e-9;
}
function createField(b, u, point, state, bb) {
  const horizontal = ['UP', 'DOWN'].includes(state.dir);
  const field = { x: point.x, y: point.y, width: horizontal ? 3 : 1,
    height: horizontal ? 1 : 3, bornAt: b.time,
    until: b.time + bb['attack@projectile_life_time'], done: false };
  (u.mem.bobbingFields ??= []).push(field);
  const info = { isSkill: true, attackId: `bobbing:field:${u.id}:${state.activation}` };
  const p = { ...ground, atkScale: bb['attack@atk_scale'] };
  const valid = () => live(u) && u.deploySeq === state.seq;
  const stop = () => {
    if (field.done) return;
    field.done = true; timer?.cancel(); watcher?.cancel();
    u.mem.bobbingFields = u.mem.bobbingFields.filter(x => x !== field);
  };
  const pulse = () => {
    if (!valid() || b.time >= field.until - 1e-9) { stop(); return; }
    for (const e of b.enemies) if (canTargetEnemy(u, e, ground) && inField(e, field))
      primary(b, u, e, p, info, bb['attack@ep_damage_ratio']);
  };
  let timer, watcher;
  // Original managedBySource0 + stopWhenSourceInvalid1: the born projectile
  // outlives main skill duration, but not source removal. This unowned bounded
  // watcher observes invalidation even after the engine releases owner timers.
  watcher = b.every(b.dt, () => { if (!valid() || b.time >= field.until - 1e-9) stop(); });
  timer = b.every(1, pulse); pulse();
  b.after(bb['attack@projectile_life_time'], stop);
}
function startField(b, u, def) {
  const state = { seq: u.deploySeq, activation: u.skill.activations, dir: u.dir,
    born: false, cancelled: false };
  u.mem.bobbingCast = state;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  // Root mode is empty-attack; native FireProjectileToTile is subordinate.
  // Capture after our mode's own disarm, so accepted foreign controls alone
  // cancel the unborn child, including controls shorter than the engine tick.
  b.addBuff(u, { key: 'bobbing:mode', flags: { disarm: true } });
  const epoch = u.attackControlEpoch;
  const attached = () => live(u) && u.mem.bobbingCast === state && u.deploySeq === state.seq
    && u.skill.active && u.skill.activations === state.activation;
  const observer = b.every(b.dt, () => {
    if (!attached() || state.born || state.cancelled) { observer.cancel(); return; }
    if (!u.canAct || u.attackControlEpoch !== epoch) { state.cancelled = true; observer.cancel(); }
  }, { owner: u });
  // waitForAttackEvent0/timeMode2 with explicit .5 preDelay. The root's
  // uninterruptible flag and child's interruptible flag are deliberately
  // separate; the main selected11-second duration remains active on child loss.
  b.after(.5, () => {
    observer.cancel();
    if (!attached() || state.cancelled || !u.canAct || u.attackControlEpoch !== epoch) return;
    const e = select(b, u, ground)[0];
    if (!e) return;
    state.born = true;
    // TileSelector0 wraps one DEFAULT WALK victim and has no height/build
    // constraint. Native root-tile/centre dispatch remains a bounded bridge.
    createField(b, u, { x: Math.round(e.x), y: Math.round(e.y) }, state, def.skill.bb);
  }, { owner: u });
  b.after(model(u).durations.Skill_2_Begin, () => {
    if (attached()) u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}
export function customizeBobbingKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...ordinary, retargetOnRelease: true, interruptOnSkillChange: true,
    acquireTargets: select, launchAttack: launch, attackVisual: 'Attack',
    windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit),
    afterAttack: (_b, unit, _targets, { inputTargets, attackId }) => {
      if (!def.skill.id.endsWith('_1') || unit.mem.bobbingEmittedAttack === attackId
        || !inputTargets.length || !inputTargets.every(t => !t.alive)) return;
      unit.skill.addCharge(1); // exact recoverSpIfTargetDead1; no born-flight refund
    } };
  const s = def.skill;
  kit.skill = s.id.endsWith('_1') ? { kind: 'instant', flags: { noSp: true },
    attack: { bobbingSkillOne: true, atkScale: s.bb.atk_scale,
      attackVisual: 'Skill_1', windup: (_b, unit) => model(unit).hits.Skill_1[0] / rate(unit) } }
    : { kind: 'duration', duration: s.duration, attack: { noAttack: true },
      canActivate: () => select(b, u, ground).length > 0,
      onStart: () => startField(b, u, def),
      onEnd: () => { u.mem.bobbingCast = null; u.mem.regularFormVisual = null;
        b.removeBuff(u, 'bobbing:mode'); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installBobbing({ unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.bobbingFields = [];
}
