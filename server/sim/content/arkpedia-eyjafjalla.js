// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-eyjafjalla-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_180_amgoat';
const present = u => u?.alive && u.deployed;
const third = u => u.skill.active && u.skill.id === 'skchr_amgoat_3';
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const components = (group, key) => evidence[group][key].flatMap(g => g.components).map(c => c.data);
const projectile = key => components('projectiles', key);
const normalSpeed = projectile('projectile_amgoat').find(c => c._speed != null)._speed;
const secondSpeed = projectile('projectile_amgoat_s2').find(c => c._speed != null)._speed;
const thirdSpeed = projectile('projectile_amgoat_s3').find(c => c._speed != null)._speed;
const radius = projectile('projectile_amgoat_s2').find(c => c.m_Radius != null).m_Radius;

function choose(b, u, p) {
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  if (third(u)) {
    // Native mode 1 random selector: distinct live choices, no goal/taunt sort.
    b.rng.shuffle(targets);
    return targets.slice(0, u.skill.bb['attack@max_target']);
  }
  for (const e of b.blockedTargets(u, p)) if (!targets.includes(e)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.eyjaInput?.[0];
  if (targets.includes(input)) { targets.splice(targets.indexOf(input), 1); targets.unshift(input); }
  return targets.slice(0, 1);
}
function form(b, u, begin) {
  const clip = begin ? 'Skill_Start' : 'Skill_End', token = {}, seq = u.deploySeq;
  // Original Back has no Volcano clips; use the delivered Front for its stance.
  u.mem.eyjaVisual = token;
  u.mem.regularFormVisual = { clip, loop: false, forceFront: true, attack: 'none' };
  b.after(evidence.models[ID].Front.durations[clip], () => {
    if (present(u) && u.deploySeq === seq && u.mem.eyjaVisual === token)
      u.mem.regularFormVisual = begin && third(u)
        ? { clip: 'Skill_Loop', loop: true, forceFront: true, attack: 'none' } : null;
  }, { owner: u });
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  u.mem.eyjaEmitted = info.attackId;
  const ignition = info.isSkill && u.skill.id === 'skchr_amgoat_2';
  const volcano = info.isSkill && u.skill.id === 'skchr_amgoat_3';
  const bb = u.skill.bb;
  b.addProjectile({ from: u, target, source: u, speed: ignition ? secondSpeed : volcano ? thirdSpeed : normalSpeed,
    maxAge: 10, visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      if (!ignition) { resolveHit(b, u, p, e, info, e.x, e.y); return; }
      // Original active buff precedes projectile damage and affects the trace
      // target alone. Other owners have independent RES multipliers.
      b.addBuff(e, { key: `eyja:res:${u.id}`, source: u, duration: bb.duration,
        mods: { resMul: 1 + bb.magic_resistance } });
      const area = { ...p, atkScale: bb.atk_scale, splashRadius: 0, hits: 1, chain: null };
      const victims = b.foesInRadius(e.x, e.y, radius, true)
        .filter(v => canTargetEnemy(u, v, { ...p, ignoreCamouflage: true }));
      // Area pass includes the trace target; the original on-end extra buff
      // then adds another independent half-strength NORMAL ranged Arts hit.
      for (const victim of victims) resolveHit(b, u, area, victim, info, victim.x, victim.y);
      if (e.alive) resolveHit(b, u, { ...area, atkScale: bb.atk_scale_2 }, e, info, e.x, e.y);
    } });
}
function syncPyrobreath(b) {
  // DEFAULT key + atk priority, independentCharacterSource=false: one highest
  // deployed source, never one copy per owner. Include untargetable casters.
  const sources = b.allyUnits.filter(a => present(a) && a.def?.charId === ID);
  let amount = 0, source = null;
  for (const a of sources) {
    const value = a.def.talents.find(t => t.bb.atk != null)?.bb.atk ?? 0;
    if (value > amount) { amount = value; source = a; }
  }
  for (const a of b.allyUnits) {
    const key = 'eyja:pyrobreath', old = a.findBuff(key);
    if (!present(a) || a.def?.profession !== 'CASTER' || !source) b.removeBuff(a, key);
    else if (!old || old.data.amount !== amount || old.source !== source)
      b.addBuff(a, { key, source, data: { amount }, mods: { atkPct: amount } });
  }
}
export function customizeEyjafjallaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', applyWay: 'ranged', dmgType: 'arts', projectile: 'orb',
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, canHitFly: true, dmgMul: null, install: null,
    acquireTargets: choose, retargetOnRelease: true, interruptOnSkillChange: true,
    windup: (_b, a, targets) => {
      a.mem.eyjaInput = targets;
      // Mode 1 excludes Attack and has no attack clip/event. Its local clock
      // releases immediately; normal Attack uses the original event and cap.
      return third(a) ? 0 : model(a).hits.Attack[0] / Math.min(1, a.s.aspd / 100);
    }, attackVisual: (_b, a) => third(a) ? 'none' : 'Attack', launchAttack: launch,
    afterAttack: (_b, a) => { a.mem.eyjaInput = null; } };
  const s = def.skill, bb = s.bb;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'duration', trigger: 'NEVER', duration: s.duration,
    onStart: () => {
      u.mem.eyjaUses = (u.mem.eyjaUses ?? 0) + 1;
      const prefix = u.mem.eyjaUses === 1 ? 'amgoat_s_1[a]' : 'amgoat_s_1[b]';
      b.addBuff(u, { key: 'eyja:duetto', source: u,
        mods: { aspd: bb[prefix + '.attack_speed'], atkPct: bb[prefix + '.atk'] ?? 0 } });
    }, onEnd: () => b.removeBuff(u, 'eyja:duetto') };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'charges', trigger: 'DEFAULT', charges: s.maxCharges,
    onStart: () => b.addBuff(u, { key: 'eyja:casting', flags: { noSp: true } }),
    onEnd: () => b.removeBuff(u, 'eyja:casting'),
    attack: { atkScale: bb.atk_scale, afterAttack: (_b, a, targets, context) => {
      a.mem.eyjaInput = null;
      if (a.mem.eyjaEmitted !== context.attackId && !targets.some(e => e.alive)
        && context.inputTargets.length && context.inputTargets.every(e => !e.alive)) a.skill.addCharge(1);
    } } };
  else kit.skill = { kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: { atkPct: bb.atk, batFlat: bb.base_attack_time }, attack: { atkScale: 1 },
    targeting: { rangeGrid: s.rangeGrid, maxTargets: bb['attack@max_target'] },
    onStart: () => { u.atkCd = 0; u.mem.eyjaInput = null; form(b, u, true); },
    onEnd: () => { u.atkCd = 0; u.mem.eyjaInput = null; if (present(u)) form(b, u, false); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installEyjafjalla({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit === u) {
      u.mem.eyjaUses = 0; u.mem.eyjaInput = null; u.mem.eyjaEmitted = null;
      u.mem.eyjaVisual = null; u.mem.regularFormVisual = null;
      const bb = def.talents.find(t => t.bb.sp_min != null)?.bb;
      // Original RandomSetter explicitly has convertToInt=false. Preserve
      // the fractional range; compiled ModifySp/UI rounding is unverified.
      if (bb) u.skill.gainSp(b.rng.range(bb.sp_min, bb.sp_max), 'eyja:wild-fire');
    }
    syncPyrobreath(b);
  }, { owner: u });
  b.on('tick', () => syncPyrobreath(b), { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit === u) {
      u.mem.eyjaVisual = null; u.mem.regularFormVisual = null; u.mem.eyjaInput = null;
      b.removeBuff(u, 'eyja:duetto'); b.removeBuff(u, 'eyja:casting');
    }
    syncPyrobreath(b);
  }, { owner: u });
}
