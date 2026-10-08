// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and intentionally bounded flag/tile/card clocks are retained
// in data/arkpedia-saileach-prefabs.json. No native executable/frame parity.
import evidence from '../../../data/arkpedia-saileach-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';
import { aggregateMods } from '../buffs.js';
import { enforceBlockCapacity, resolveHit } from '../ai.js';

const ID = 'char_479_sleach', SECOND = 'skchr_sleach_2', THIRD = 'skchr_sleach_3';
const PROFESSIONS = new Set(['WARRIOR', 'SNIPER', 'TANK', 'MEDIC', 'SUPPORT', 'CASTER', 'SPECIAL', 'PIONEER']);
const present = u => u?.alive && u.deployed;
const live = u => present(u) && !u.hidden;
const operator = u => u.kind === 'op' && PROFESSIONS.has(u.def.profession);
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const keys = (u, range, center = u) => new Set(absoluteRangeKeys(evidence.ranges[range].grids.map(g => [g.row, g.col]),
  center.tileR, center.tileC, u.dir));
// PurposeNONE permits heal-free/noHeal, including full HP. Initial S2 still
// rejects isolation; the banner collision explicitly ignores it and target-free.
const initialAlly = (b, u, a) => live(a) && operator(a) && b.allySelectable(a, u);
const flagAlly = a => live(a) && operator(a);
const auraEnemy = e => live(e) && !e.s.flags.untargetable;
const costEligible = (b, id) => PROFESSIONS.has(b.data.getChess(id)?.profession);

/** Source flat UNTIL_NEXT_SPAWN_SYNC_WITH_BUFF applies after the existing
 * ordinary redeploy/card calculation. Native C# rounding/order is unrecovered. */
export function adjustSaileachCost(b, id, ordinaryCost) {
  if (!Number.isFinite(ordinaryCost) || !costEligible(b, id)) return ordinaryCost;
  const gifts = [...(b._arkpediaSaileachCards ?? new Map()).values()]
    .filter(g => present(g.owner) && g.owner !== b.bench[id]?.unit);
  return Math.max(0, ordinaryCost + (gifts.length ? Math.min(...gifts.map(g => g.value)) : 0));
}
/** Root calls after a successful ordinary operator spawn only. Failed/cancelled
 * placements and tokens cannot consume it; own born filter skips that spawn. */
export function consumeSaileachCard(b, id) {
  if (!costEligible(b, id)) return;
  const entries = [...(b._arkpediaSaileachCards ?? new Map()).entries()]
    .filter(([, g]) => present(g.owner) && g.owner !== b.bench[id]?.unit)
    .sort((a, z) => a[1].value - z[1].value || a[1].owner.deploySeq - z[1].owner.deploySeq);
  if (entries.length) b._arkpediaSaileachCards.delete(entries[0][0]);
}

function ordinary(b, u, p) {
  const out = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!out.includes(e)) out.push(e);
  sortEnemyTargets(b, u, out, p.priority);
  return out.slice(0, 1);
}
function chooseSecond(b, u) {
  const area = keys(u, 'x-1');
  return b.allyUnits.filter(a => initialAlly(b, u, a) && bodyInKeys(a, area))
    .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq)[0];
}
function thirdTiles(b, u) {
  const area = keys(u, '2-1'), result = new Map();
  for (const e of b.enemies) {
    if (!auraEnemy(e) || e.isFlying || !bodyInKeys(e, area)) continue;
    const r = Math.round(e.y), c = Math.round(e.x), tile = b.grid.tile(r, c);
    if (tile?.height !== 'LOW' || !area.has(r * COLS + c)) continue;
    result.set(`${r},${c}`, { tileR: r, tileC: c });
  }
  return [...result.values()];
}
function owned(b, u, target, key, mods, active) {
  if (!active) b.removeBuff(target, key);
  else if (JSON.stringify(target.findBuff(key)?.mods) !== JSON.stringify(mods))
    b.addBuff(target, { key, source: u, mods });
}
function sync(b, u) {
  const flag = u.mem.saileachFlag;
  // Source-valid tile projectiles stop on owner disappearance; a restored owner
  // does not secretly recreate a stopped field inside the same activation.
  if (flag && !live(u)) u.mem.saileachFlag = null;
  const activeFlag = live(u) && u.skill.active && u.mem.saileachFlag;
  const center = activeFlag || u;
  const talentActive = present(u) && (!!activeFlag || !(u.skill.active && [SECOND, THIRD].includes(u.skill.id)));
  // Original owner-centered T1 components exist only under Default/S1.
  // A stopped S2/S3 flag cannot restore that mode's absent owner aura early.
  const talent = u.def.talents.find(t => t.bb['sleach_t_1[ally].attack_speed'] != null)?.bb;
  const area = keys(u, 'x-4', center), first = `saileach:t1-ally:${u.id}`, enemyKey = `saileach:t1-enemy:${u.id}`;
  for (const a of b.allyUnits) {
    // Literal profession639/default kind is mapped narrowly to ordinary ops.
    owned(b, u, a, first, { aspd: talent?.['sleach_t_1[ally].attack_speed'] ?? 0 },
      !!talent && talentActive && flagAlly(a) && bodyInKeys(a, area));
    const k = `saileach:s2:${u.id}`;
    const eligible = activeFlag && u.skill.id === SECOND && flagAlly(a)
      && bodyInKeys(a, keys(u, '0-1', activeFlag));
    if (!eligible) { b.removeBuff(a, k); continue; }
    if (!a.findBuff(k)) {
      const flagIdentity = activeFlag;
      const pulse = () => {
        if (!live(u) || !u.skill.active || u.skill.id !== SECOND || u.mem.saileachFlag !== flagIdentity
          || !flagAlly(a) || !bodyInKeys(a, keys(u, '0-1', flagIdentity))) return;
        const multiplier = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
        b.heal(u, a, u.s.atk * u.def.skill.bb.atk_to_hp_recovery_ratio * multiplier, { self: true, regen: true });
      };
      b.addBuff(a, { key: k, source: u, mods: { defPct: u.def.skill.bb.def }, interval: 1, onTick: pulse });
      pulse(); // Literal waitFirstTriggerInterval0.
    }
  }
  for (const e of b.enemies) {
    owned(b, u, e, enemyKey, { aspd: talent?.['sleach_t_1[enemy].attack_speed'] ?? 0 },
      !!talent && talentActive && auraEnemy(e) && bodyInKeys(e, area));
    const k = `saileach:s3-sluggish:${u.id}`, wk = `saileach:s3-fragile:${u.id}`;
    const eligible = activeFlag && u.skill.id === THIRD && auraEnemy(e)
      && bodyInKeys(e, keys(u, 'x-4', activeFlag));
    if (!eligible) { b.removeBuff(e, k); b.removeBuff(e, wk); }
    else {
      if (!e.findBuff(k)) b.applyStatus(e, 'sluggish', { key: k, source: u });
      const value = u.def.skill.bb['debuff.damage_scale'];
      if (e.findBuff(wk)?.data.value !== value) {
        b.removeBuff(e, wk); b.applyStatus(e, 'fragile', { key: wk, source: u, value });
      }
    }
  }
}
function beginVisual(b, u, n) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: `Skill_${n}_Begin`, loop: false };
  b.after(model(u).durations[`Skill_${n}_Begin`], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: `Skill_${n}_Loop`, loop: true };
  }, { owner: u });
}
function endVisual(b, u, n, reason) {
  if (!live(u) || ['death', 'retreat', 'interrupted'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: `Skill_${n}_End`, loop: false };
  b.after(model(u).durations[`Skill_${n}_End`], () => {
    if (u.deploySeq === seq && u.skill.activations === activation && !u.skill.active) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function blast(b, u, center, s) {
  // Original no-movement projectile is unmanaged, source-invalid-stop0,
  // lifetime1/alwaysReachInTheEnd1/onlyCheckHitWhenStop1. This bounded end
  // clock is independent of the owner/mode/deployment after emission.
  const attackId = ++b._attackSeq;
  b.after(1, () => {
    const area = keys(u, 'x-4', center);
    for (const e of b.enemies) if (auraEnemy(e) && bodyInKeys(e, area)) {
      b.applyStatus(e, 'stun', { source: u, duration: s.bb.stun });
      b.dealDamage(u, e, { amount: u.s.atk * s.bb.atk_scale, type: 'phys', isAttack: true,
        isSkill: true, applyWay: 'melee', noSp: false, attackId, tags: ['saileach:flag-blast'] });
    }
  });
}
export function customizeSaileachKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, hits: 1, hitsFn: null,
    allInRange: false, rangeAoe: false, splashRadius: 0, chain: null, dmgMul: null, heal: null,
    acquireTargets: ordinary, retargetOnRelease: true, interruptOnSkillChange: true,
    windup: () => model(u).hits.Attack[0] / (u.base.bat / u.s.interval), attackVisual: 'Attack',
    launchAttack: (battle, actor, profile, target, metadata) => resolveHit(battle, actor, profile, target, metadata, target.x, target.y) };
  const s = def.skill, n = s.id === SECOND ? 2 : s.id === THIRD ? 3 : 1;
  let elapsed, granted;
  kit.skill = { kind: 'duration', duration: s.duration, mods: { blockCntMul: 0 },
    flags: { disarm: true }, attack: { noAttack: true },
    canActivate: () => n === 1 || (n === 2 ? !!chooseSecond(b, u) : thirdTiles(b, u).length > 0),
    onStart: () => {
      elapsed = granted = 0; enforceBlockCapacity(b, u);
      u.mem.saileachFlag = n === 1 ? null : n === 2
        ? (() => { const a = chooseSecond(b, u); return { tileR: a.tileR, tileC: a.tileC }; })()
        : b.rng.pick(thirdTiles(b, u));
      beginVisual(b, u, n);
      if (n === 3) { b.addDp(u.ownerId, s.bb.cost); blast(b, u, { ...u.mem.saileachFlag }, s); }
      sync(b, u);
    },
    onTick: ({ dt, skill }) => {
      if (n !== 3 && present(u)) {
        elapsed += Math.min(dt, Math.max(0, skill.timeLeft));
        const interval = n === 1 ? s.bb.interval : s.bb['sleach_s_2[cost].interval'];
        const amount = n === 1 ? s.bb.cost : s.bb['sleach_s_2[cost].cost'];
        while (granted < s.bb.value && elapsed + 1e-9 >= (granted + 1) * interval) { granted++; b.addDp(u.ownerId, amount); }
      }
      sync(b, u);
    },
    onEnd: ({ reason }) => { u.mem.saileachFlag = null; sync(b, u); endVisual(b, u, n, reason); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installSaileach({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  (b._arkpediaSaileachOwners ??= new Map()).set(u.id, u);
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.saileachFlag = null;
    const value = def.talents.find(t => t.bb.value != null)?.bb.value;
    if (value != null) (b._arkpediaSaileachCards ??= new Map()).set(u.id, { owner: u, value });
    sync(b, u);
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    b._arkpediaSaileachCards?.delete(u.id); u.mem.saileachFlag = null; sync(b, u);
  }, { owner: u });
  b.on('tick', () => sync(b, u), { owner: u });
}
