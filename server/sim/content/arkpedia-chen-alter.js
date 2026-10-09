// SPDX-License-Identifier: GPL-3.0-or-later
// Original graph, count holders, range tables and animation bindings are retained
// in data/arkpedia-chen-alter-prefabs.json. Native dispatch/FX are not certified.
import evidence from '../../../data/arkpedia-chen-alter-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_1013_chen2';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const mode = u => u.skill?.active ? Number(u.skill.id.at(-1)) : 0;
const prefix = n => n === 1 ? 'Skill' : `Skill_${n - 1}`;
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys', applyWay: 'melee',
  canHitFly: true, hits: 1, splashRadius: 0, chain: null, maxTargets: 1 };
const nearGrid = evidence.tables.ranges['1-3'].grids.map(g => [g.row, g.col]);
function attackClip(u) {
  const n = mode(u), stem = n ? `${prefix(n)}_Loop` : 'Attack';
  return u.dir === 'DOWN' ? `${stem}_Down` : stem;
}
function slime(b, u, e, bb, duration) {
  if (!live(e) || e.isFlying) return;
  // Native FINAL_SCALER and FINAL_ADDITION, one shared nonstacking buff.
  b.addBuff(e, { key: 'chen2:slime', source: u, duration, refresh: 'replace',
    mods: { moveMul: 1 + bb['attack@move_speed'], defFinalFlat: bb['attack@def'] } });
}
function field(b, u) {
  const n = mode(u); if (n < 2) return;
  const bb = { ...u.skill.bb }, keys = new Set(u.rangeKeys), until = b.time + bb['attack@projectile_life_time'];
  // The original immediate-reach projectile stays at its source-facing range,
  // polls every .2s and does not stop when the source is invalid. Timers therefore
  // have no character owner; cancellation/retreat cannot erase a fired field.
  const pulse = () => {
    for (const e of b.enemies) if (live(e) && !e.isFlying && bodyInKeys(e, keys)) slime(b, u, e, bb, .25);
  };
  pulse();
  const timer = b.every(.2, () => { if (b.time + 1e-9 >= until) timer.cancel(); else pulse(); });
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const n = mode(u), close = n === 1 || n === 3 || bodyInKeys(e,
    new Set(absoluteRangeKeys(nearGrid, u.tileR, u.tileC, u.dir)));
  // The native active debuff is not damage-missable; it is present for the
  // following calculation even on a dodged shot. Field pulses refresh it later.
  if (n >= 2) slime(b, u, e, u.skill.bb, .1);
  resolveHit(b, u, { ...plain, atkScale: close ? u.def.traitBb.atk_scale : 1,
    hits: n === 3 ? 2 : 1 }, e, info, e.x, e.y);
}
function startup(b, u) {
  const n = mode(u), name = prefix(n), seq = u.deploySeq, activation = u.skill.activations;
  if (n === 2) {
    const charged = u.skill.charges >= 1; // Runtime has consumed the first charge.
    u.skill.ammoLeft = charged ? u.skill.bb['attack@another_trigger_time'] : u.skill.bb['attack@trigger_time'];
    u.skill.ammoMax = u.skill.ammoLeft;
    // The native enhance judge clears even a partial second charge. The public
    // SP setter intentionally ignores running ammo skills, so clear the holder.
    u.skill.sp = 0;
    u.skill.charges = 0;
  }
  u.mem.regularFormVisual = { clip: `${name}_Begin`, loop: false };
  b.addBuff(u, { key: 'chen2:begin', duration: model(u).durations[`${name}_Begin`], flags: { disarm: true } });
  b.after(model(u).durations[`${name}_Begin`], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: `${name}_Idle`, loop: true };
  }, { owner: u });
}
function consume(ctx) {
  const { battle: b, unit: u, skill: s, noAmmo } = ctx;
  ctx.noAmmo = true;
  if (noAmmo || !s.active) return;
  const n = mode(u), cost = n === 3 ? 2 : 1;
  s.ammoLeft = Math.max(0, s.ammoLeft - cost);
  if (b._hooks.ammoUsed) b.emit('ammoUsed', { unit: u, left: s.ammoLeft, skill: s, count: cost });
  if (s.ammoLeft > 0) return;
  if (n === 1) { s.end('ammo'); return; }
  // S1's holder resets immediately; S2/S3 retain the last attack's animation
  // tail. This native count-event handoff is a documented local mapping.
  const seq = u.deploySeq, activation = s.activations, clip = attackClip(u);
  const post = (model(u).durations[clip] - model(u).hits[clip][0]) / rate(u);
  b.addBuff(u, { key: 'chen2:last-shot', flags: { disarm: true } });
  b.after(post, () => {
    if (live(u) && u.deploySeq === seq && s.active && s.activations === activation) s.end('ammo');
  }, { owner: u });
}
function finish(b, u, reason) {
  b.removeBuff(u, 'chen2:begin'); b.removeBuff(u, 'chen2:last-shot');
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const name = prefix(Number(u.skill.id.at(-1))), seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: `${name}_End`, loop: false };
  b.addBuff(u, { key: 'chen2:end', duration: model(u).durations[`${name}_End`], flags: { disarm: true } });
  b.after(model(u).durations[`${name}_End`], () => {
    if (u.deploySeq === seq) u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeChenAlterKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, allInRange: true, rangeAoe: false, hitsFn: null, dmgMul: null,
    hitAllBlocked: false, maxTargetsByBlock: false, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true,
    canAttack: () => !u.skill?.active || u.skill.ammoLeft > 0,
    windup: () => model(u).hits[attackClip(u)][0] / rate(u),
    attackVisual: () => attackClip(u), launchAttack: launch,
    // Field creation precedes ammo exhaustion so the last attack still fires it.
  };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = { id: s.id, name: s.name, kind: 'ammo', ammo: s.bb['attack@trigger_time'],
    duration: 0, trigger: n === 1 ? 'SP_FULL' : 'NEVER', manualCancel: true,
    chargedState: () => n === 2 && u.skill.charges === 2,
    canActivate: () => !u.findBuff('chen2:end'),
    targeting: n === 3 ? { rangeGrid: s.rangeGrid } : {},
    mods: { atkPct: s.bb.atk }, attack: {},
    onStart: () => startup(b, u),
    onAttack: ctx => { field(b, u); consume(ctx); },
    onEnd: ({ reason }) => finish(b, u, reason) };
}
export function installChenAlter({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const vacation = def.talents.find(t => t.bb['chen2_t_2[common].attack_speed'] != null)?.bb;
  if (vacation) b.addBuff(u, { key: 'chen2:vacation', persist: true, allowDead: true,
    mods: { aspd: vacation['chen2_t_2[common].attack_speed']
      + (b.mapTags.includes('water') ? vacation['chen2_t_2[map].attack_speed'] : 0) } });
  const saving = def.talents.find(t => t.bb['spareshot_chen.prob'] != null)?.bb;
  if (saving) b.on('beforeAmmoUse', ctx => {
    if (!live(u) || ctx.unit?.kind !== 'op' || ctx.unit.def?.profession !== 'SNIPER') return;
    const chance = ctx.unit === u ? saving['spareshot_chen.prob'] : saving.prob;
    ctx.spareShotProb = Math.max(ctx.spareShotProb ?? 0, chance);
  }, { owner: u });
}
