// SPDX-License-Identifier: GPL-3.0-or-later
// Original ranks, components, buff closure and skeletons: arkpedia-vina-prefabs.
// The serialized controllers are mapped onto the local combat tick, not native
// C# dispatch/frame parity. No module or original particle support is claimed.
import evidence from '../../../data/arkpedia-vina-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { COLS } from '../constants.js';
const ID = 'char_1019_siege2', TOKEN = 'token_10040_siege2_vlion';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const active = (u, n) => u.skill?.active && u.skill.id === `skchr_siege2_${n}`;
const grid = name => evidence.tables.ranges[name].grids.map(p => [p.row, p.col]);
const nearby = (b, u, blockers = false) => {
  const keys = absoluteRangeKeys(grid('x-4'), u.tileR, u.tileC, u.dir);
  return b.allyUnits.filter(a => live(a) && (blockers ? ['op', 'token', 'device'] : ['op', 'token']).includes(a.kind)
    && (blockers || !(a.s.flags.untargetable || a.s.flags.isolate))
    && keys.includes(a.tileR * COLS + a.tileC));
};
function targets(b, u, p) {
  if (!active(u, 3)) return null;
  const keys = absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir);
  const blockers = new Set(nearby(b, u, true));
  const es = b.enemies.filter(e => canTargetEnemy(u, e, p)
    && (keys.includes(e.tileR * COLS + e.tileC) || blockers.has(e.blockedBy)));
  sortEnemyTargets(b, u, es, null);
  return es.slice(0, u.skill.bb['attack@max_target']);
}
function windup(b, u) {
  let clip;
  if (u.skill.pending && u.skill.id.endsWith('_1')) clip = 'Skill_1';
  else if (active(u, 2)) clip = u.dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop';
  else if (active(u, 3)) clip = 'Skill_3_Loop';
  else { u.mem.vinaAlternate = !u.mem.vinaAlternate; clip = u.mem.vinaAlternate ? 'Attack_1' : 'Attack_2'; }
  u.mem.vinaAttackClip = clip;
  return model(u).hits[clip][0] / rate(u);
}
function opening(b, u, n, onReady) {
  const clip = `Skill_${n}_Begin`, seq = u.deploySeq, activation = u.skill.activations;
  u.mem.vinaOpening = true;
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'vina:begin', duration: model(u).durations[clip], flags: { disarm: true } });
  b.after(model(u).durations[clip], () => {
    if (!live(u) || u.deploySeq !== seq || u.skill.activations !== activation || !active(u, n)) return;
    u.mem.vinaOpening = false;
    u.mem.regularFormVisual = { clip: `Skill_${n}_Idle`, loop: true };
    onReady?.();
  }, { owner: u });
}
function tokenRecord(b, u) {
  const src = b.data.raw.tokens[TOKEN], build = u.def.raw.arkpedia, phase = src.phases[build.elite];
  const lo = phase.attributesKeyFrames[0], hi = phase.attributesKeyFrames.at(-1);
  const f = (build.level - lo.level) / (hi.level - lo.level || 1);
  const stats = Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + ((hi.data[k] ?? v) - v) * f]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return { id: TOKEN, name: src.name, profession: src.profession, subProfessionId: src.subProfessionId,
    position: src.position, stats, rangeGrid: phase.rangeGrid, talents: [], skill: null,
    abnormal: ['healFree'], avatar: src.avatar, arkpedia: { ...build } };
}
function clearTokens(b, u) {
  for (const t of b.allyUnits.filter(t => live(t) && t.ownerUnit === u && t.defId === TOKEN)) {
    t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'Die_2' };
    b.retreat(t, { permanent: true, reason: 'vina-skill-finished' });
  }
}
function summon(b, u) {
  for (const key of absoluteRangeKeys(grid('x-4'), u.tileR, u.tileC, u.dir)) {
    const r = Math.floor(key / COLS), c = key % COLS;
    if (!b.grid.inRect(r, c) || b.grid.tile(r, c).height !== 'LOW'
      || !['MELEE', 'ALL'].includes(b.grid.tile(r, c).build) || b.downOn(r, c) || b.tileReservation(r, c)
      || b.allyUnits.some(a => live(a) && a.tileR === r && a.tileC === c)) continue;
    const m = evidence.models[TOKEN];
    b.spawnToken(u, TOKEN, r, c, { def: tokenRecord(b, u), dir: u.dir,
      kit: { skill: null, trait: { attack: 'melee', projectile: 'none', dmgType: 'true',
        maxTargets: 1, canHitFly: false, hitAllBlocked: false, retargetOnRelease: false,
        windup: (_b, t) => m.hits.Attack[0] / rate(t), attackVisual: 'Attack' },
      install: (battle, t) => {
        t.deploymentSlotCost = 0;
        battle.addBuff(t, { key: 'vina:heal-free', persist: true, allowDead: true,
          flags: { healFree: true }, mods: { hpRegenMul: 0, spRecoveryMul: 0 } });
      } } });
  }
}
export function customizeVinaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'arts', canHitFly: false,
    maxTargets: 1, hits: 1, splashRadius: 0, allInRange: false, hitAllBlocked: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.vinaOpening, acquireTargets: (_b, _u, p) => targets(b, u, p),
    windup: () => windup(b, u), attackVisual: () => u.mem.vinaAttackClip,
    launchAttack: (_b, _u, p, e, info) => {
      if (canTargetEnemy(u, e, p)) resolveHit(b, u, p, e, info, e.x, e.y);
      if (!p.vinaS1 || u.mem.vinaAoeAttack === info.attackId) return;
      u.mem.vinaAoeAttack = info.attackId;
      const keys = absoluteRangeKeys(def.skill.rangeGrid, u.tileR, u.tileC, u.dir);
      for (const victim of b.enemiesInKeys(keys, u, { canHitFly: false }))
        b.dealDamage(u, victim, { amount: u.s.atk * u.s.atkScaleMul * def.skill.bb.atk_scale,
          type: 'true', applyWay: 'melee', isSkill: true, isAttack: true, isSplash: true,
          attackId: info.attackId, tags: ['vina:s1-area'] });
    } };
  const s = def.skill, n = Number(s.id.at(-1)), bb = s.bb;
  kit.skill = n === 1 ? { kind: 'instant', trigger: 'DEFAULT', flags: { noSp: true },
    attack: { vinaS1: true, dmgType: 'arts', atkScale: 1 } }
    : { kind: n === 2 ? 'toggle' : 'duration', ...(n === 2 ? { trigger: 'SP_FULL' } : {}),
      mods: { atkPct: bb.atk, ...(n === 3 ? { batFlat: bb.base_attack_time } : {}) },
      attack: { maxTargets: bb['attack@max_target'], ...(n === 3 ? { dmgType: 'true' } : {}) },
      ...(n === 2 ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
      onStart: () => opening(b, u, n, n === 3 ? () => summon(b, u) : null),
      onEnd: () => {
        u.mem.vinaOpening = false; b.removeBuff(u, 'vina:begin');
        u.mem.regularFormVisual = null;
        if (n === 3) clearTokens(b, u);
      } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installVina({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t1 = def.talents.find(t => t.bb.damage_resistance != null)?.bb;
  const t2 = def.talents.find(t => t.bb.not_combat != null)?.bb;
  const seen = new Set(), aura = new Set(), auraKey = `vina:aura:${u.id}`;
  const sync = () => {
    const allies = live(u) && t1 ? nearby(b, u).filter(a => a !== u) : [];
    for (const a of aura) if (!allies.includes(a)) { b.removeBuff(a, auraKey); aura.delete(a); }
    for (const a of allies) if (!aura.has(a)) {
      aura.add(a); b.addBuff(a, { key: auraKey, mods: { physTakenMul: 1 - t1.damage_resistance }, source: u });
    }
    const count = allies.length;
    b.removeBuff(u, 'vina:kings'); b.removeBuff(u, 'vina:sp');
    if (live(u) && t1) b.addBuff(u, { key: 'vina:kings', mods: { atkPct: t1.atk * count } });
    if (live(u) && u.skill.id.endsWith('_2') && count >= def.skill.bb.buff_stack_cnt)
      b.addBuff(u, { key: 'vina:sp', mods: { spRecoveryFlat: def.skill.bb.sp_recovery_per_sec } });
  };
  if (t1) b.addBuff(u, { key: 'vina:self-resistance', persist: true, allowDead: true,
    mods: { physTakenMul: 1 - t1.damage_resistance } });
  b.on('tick', sync, { owner: u });
  b.on('deploy', sync, { owner: u });
  b.on('hit', ({ source, target }) => {
    if (source !== u || !t2 || target.side !== 'enemy' || seen.has(target)) return;
    if (b.applyStatus(target, 'tremble', { source: u, duration: t2.not_combat })) seen.add(target);
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) {
      clearTokens(b, u); seen.clear();
      for (const a of aura) b.removeBuff(a, auraKey);
      aura.clear(); u.mem.vinaOpening = false; u.mem.regularFormVisual = null;
    } else if (aura.has(unit)) sync();
  }, { owner: u });
}
