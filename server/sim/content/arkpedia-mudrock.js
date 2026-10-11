// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-mudrock-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_311_mudrok';
const live = u => u?.alive && u.deployed && !u.hidden;
const second = u => u.skill.pending && u.skill.id === 'skchr_mudrok_2';
const awake = u => u.skill.active && u.mem.mudrockAwake;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => second(u) ? u.base.bat / u.s.interval : Math.min(1, u.base.bat / u.s.interval);
const clip = u => second(u) ? 'Skill_1' : awake(u) ? 'Skill_2_Attack' : 'Attack';
const layerKey = 'mudrock:layers', shelterKey = 'mudrock:sheltering', awakeKey = 'mudrock:awake';
const grid = id => evidence.tables.ranges[id].grids.map(p => [p.row, p.col]);
const area = (b, u, id, air = false) => b.enemiesInKeys(absoluteRangeKeys(grid(id), u.tileR, u.tileC, u.dir), u, { canHitFly: air });
function choose(b, u, p) {
  if (second(u)) return area(b, u, 'x-4');
  const targets = b.enemiesInKeys(u.baseRangeKeys, u, p);
  for (const e of u.blocking) if (!targets.includes(e) && canTargetEnemy(u, e, p)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.mudrockInput?.[0];
  if (!awake(u) && targets.includes(input)) return [input];
  return targets.slice(0, awake(u) ? Math.max(0, Math.floor(u.s.blockCnt)) : 1);
}
function visual(b, u, name, idle, front = false) {
  const seq = u.deploySeq, token = {};
  u.mem.mudrockVisual = token;
  u.mem.regularFormVisual = { clip: name, loop: false, ...(front ? { forceFront: true } : {}) };
  b.after(evidence.models[ID][front ? 'Front' : u.dir === 'UP' ? 'Back' : 'Front'].durations[name], () => {
    if (live(u) && u.deploySeq === seq && u.mem.mudrockVisual === token)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true, ...(front ? { forceFront: true } : {}) } : null;
  }, { owner: u });
}
function clearAura(b, u) {
  for (const e of u.mem.mudrockAura ?? []) b.removeBuff(e, `mudrock:slow:${u.id}`);
  u.mem.mudrockAura = new Set();
}
function aura(b, u) {
  const next = new Set(area(b, u, 'x-1', true)), key = `mudrock:slow:${u.id}`;
  for (const e of u.mem.mudrockAura ?? []) if (!next.has(e)) b.removeBuff(e, key);
  for (const e of next) if (!e.findBuff(key)) b.addBuff(e, { key, source: u, mods: { moveMul: 1 + u.skill.bb.move_speed } });
  u.mem.mudrockAura = next;
}
function startThird(b, u) {
  const cast = u.skill.activations, seq = u.deploySeq;
  u.mem.mudrockAwake = false;
  b.addBuff(u, { key: shelterKey, source: u, flags: { sleep: true, invulnerable: true } });
  // SLEEPING also releases existing blockers, not merely future block picks.
  for (const e of u.blocking.slice()) b._unblock(e);
  visual(b, u, 'Skill_2_Begin', 'Skill_2_Sleep', true); aura(b, u);
  const valid = () => live(u) && u.deploySeq === seq && u.skill.activations === cast && u.skill.active;
  b.after(u.skill.bb.sleep, () => {
    if (!valid()) return;
    b.removeBuff(u, shelterKey); clearAura(b, u);
    // Recovered wrapper emits its finish after the original Awake animation.
    b.addBuff(u, { key: 'mudrock:awakening', flags: { disarm: true } });
    visual(b, u, 'Skill_2_Awake', 'Skill_2_Idle', true);
    b.after(evidence.models[ID].Front.durations.Skill_2_Awake, () => {
      if (!valid()) return;
      b.removeBuff(u, 'mudrock:awakening'); u.mem.mudrockAwake = true;
      b.addBuff(u, { key: awakeKey, source: u,
        mods: { atkPct: u.skill.bb.atk, defPct: u.skill.bb.def, batPct: u.skill.bb.base_attack_time } });
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
      for (const e of area(b, u, 'x-1')) b.applyStatus(e, 'stun', { source: u, duration: u.skill.bb.stun });
    }, { owner: u });
  }, { owner: u });
}
function clearThird(b, u) {
  u.mem.mudrockAwake = false; clearAura(b, u);
  for (const key of [shelterKey, awakeKey, 'mudrock:awakening']) b.removeBuff(u, key);
  if (live(u)) visual(b, u, 'Skill_2_End', null);
}
export function customizeMudrockKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', applyWay: 'melee', projectile: 'none',
    noHeal: true, selfHeal: null, canHitFly: false, hits: 1, hitsFn: null, maxTargets: 1,
    maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false, rangeAoe: false, dmgMul: null,
    chain: null, splashRadius: 0, install: null, acquireTargets: choose, retargetOnRelease: true,
    interruptOnSkillChange: true, attackEpoch: (_b, a) => !!a.mem.mudrockAwake,
    windup: (_b, a, targets) => { a.mem.mudrockInput = targets; return model(a).hits[clip(a)][0] / rate(a); },
    attackVisual: (_b, a) => clip(a), afterAttack: (_b, a) => { a.mem.mudrockInput = null; },
    launchAttack: (_b, a, p, e, info) => {
      if (!canTargetEnemy(a, e, p)) return;
      if (second(a) && b.rng.chance(a.skill.bb.buff_prob)) b.applyStatus(e, 'stun', { source: a, duration: a.skill.bb.stun });
      resolveHit(b, a, p, e, info, e.x, e.y);
    },
  };
  const s = def.skill;
  if (s.id === 'skcom_def_up[3]') kit.skill = { kind: 'duration', trigger: 'NEVER', mods: { defPct: s.bb.def } };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'instant',
    trigger: { rule: 'CUSTOM_RANGE', grid: grid('x-4') },
    targeting: { rangeGrid: grid('x-4'), showOwnRange: true, allInRange: true },
    onStart: () => b.addBuff(u, { key: 'mudrock:s2-lock', flags: { noSp: true } }),
    onEnd: () => b.removeBuff(u, 'mudrock:s2-lock'),
    attack: { atkScale: s.bb.atk_scale, afterAttack: () => {
      b.heal(u, u, u.s.maxHp * s.bb.hp_ratio, { self: true, ignoreHealFree: true }); u.mem.mudrockInput = null;
    } },
  };
  else kit.skill = { kind: 'duration', trigger: 'NEVER', attack: {},
    duration: s.bb.sleep + evidence.models[ID].Front.durations.Skill_2_Awake + s.bb.awake,
    onStart: () => startThird(b, u), onEnd: () => clearThird(b, u) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installMudrock({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t = def.talents.find(t => t.bb.interval != null).bb;
  const cut = def.talents.find(t => t.bb.damage_resistance != null)?.bb.damage_resistance;
  const layers = () => u.findBuff(layerKey)?.shieldHits ?? 0;
  const set = n => {
    const buff = u.findBuff(layerKey);
    if (n <= 0) b.removeBuff(u, layerKey);
    else if (buff) { buff.shieldHits = n; u.markDirty(); }
    else b.addBuff(u, { key: layerKey, source: u, shieldHits: n, visible: true });
  };
  function recharge() {
    if (!live(u) || u.mem.mudrockRecharge || layers() >= t.max_times) return;
    const seq = u.deploySeq;
    u.mem.mudrockRecharge = b.after(t.interval, () => {
      u.mem.mudrockRecharge = null;
      if (!live(u) || u.deploySeq !== seq) return;
      set(Math.min(t.max_times, layers() + t.times)); recharge();
    }, { owner: u });
  }
  b.on('deploy', ({ unit }) => { if (unit === u) { set(Math.min(t.max_times, t.times)); recharge(); } }, { owner: u });
  b.on('hit', ({ target, source, dmg }) => {
    if (target === u && cut && source?.tags?.has('sarkaz')) dmg.mul *= 1 - cut;
  }, { owner: u });
  b.on('damageFinal', ctx => {
    if (ctx.target !== u || !live(u) || layers() <= 0) return;
    const full = layers() === t.max_times;
    set(layers() - 1); ctx.amount = 0;
    b.heal(u, u, u.s.maxHp * t.hp_ratio, { self: true, ignoreHealFree: true });
    if (full) recharge();
  }, { owner: u });
  b.on('beforeBuff', ctx => {
    if (ctx.unit === u && u.findBuff(shelterKey)
      && (ctx.buff.flags?.stun || ctx.buff.flags?.cold || ctx.buff.flags?.freeze)) ctx.cancel = true;
  }, { owner: u });
  b.on('tick', () => {
    if (!live(u)) return;
    if (u.findBuff(shelterKey)) aura(b, u);
    if (second(u) && (!u.canAct || u.s.flags.disarm)) u.skill.end('interrupted');
  }, { owner: u });
  for (const event of ['retreat', 'death']) b.on(event, ({ unit }) => { if (unit === u) {
    u.mem.mudrockRecharge?.cancel(); u.mem.mudrockRecharge = null;
    clearThird(b, u); set(0); b.removeBuff(u, 'mudrock:s2-lock');
    u.mem.mudrockVisual = null; u.mem.regularFormVisual = null;
  } }, { owner: u });
}
