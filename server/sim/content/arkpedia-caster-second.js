// SPDX-License-Identifier: GPL-3.0-or-later
import { CASTER_SECOND_OPERATORS } from '../../../shared/arkpedia/caster-second-operators.js';
import evidence from '../../../data/arkpedia-caster-second-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const CAR = 'char_426_billro', PAS = 'char_472_pasngr';
const live = u => u?.alive && u.deployed;
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const playback = u => Math.min(1, u.s.aspd / 100);
const windup = clip => (_b, u) => model(u).hits[typeof clip === 'function' ? clip(u) : clip][0] / playback(u);

function syncCarnelian(b, u) {
  const active = live(u) && u.skill.active;
  const retain = active && u.skill.id === 'skchr_billro_1' && u.mem.carnelianCharged;
  const trait = 'carnelian:phalanx';
  if (!live(u) || active && !retain) b.removeBuff(u, trait);
  else if (!u.findBuff(trait)) b.addBuff(u, { key: trait, source: u,
    mods: { defPct: u.def.traitBb.def, resFlat: u.def.traitBb.magic_resistance } });
  const t = u.def.talents.find(t => t.bb.sp_recovery_per_sec != null)?.bb;
  const ready = live(u) && !active && u.skill.charges >= 1;
  if (!t || !ready) b.removeBuff(u, 'carnelian:poised');
  else if (!u.findBuff('carnelian:poised')) b.addBuff(u, { key: 'carnelian:poised', source: u,
    mods: { spRecoveryFlat: t.sp_recovery_per_sec } });
  const marking = active && u.skill.id === 'skchr_billro_3' && u.mem.carnelianCharged;
  const eligible = new Set(marking ? b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true }) : []);
  for (const e of b.enemies) {
    const key = `carnelian:mark:${u.id}`;
    if (!eligible.has(e)) { b.removeBuff(e, key); b.removeBuff(e, `carnelian:stack:${u.id}`); }
    else if (!e.findBuff(key)) b.addBuff(e, { key, source: u });
  }
}
function carnelianLaunch(b, u, p, _target, info) {
  const bb = u.def.skill.bb, charged = u.mem.carnelianCharged;
  for (const e of b.enemiesInKeys(u.rangeKeys, u, p)) {
    if (u.skill.id === 'skchr_billro_2') b.applyStatus(e, charged ? 'bind' : 'sluggish', {
      source: u, duration: bb[charged ? 'attack@root' : 'attack@sluggish'] });
    if (u.skill.id === 'skchr_billro_3' && charged) {
      const key = `carnelian:stack:${u.id}`, count = Math.min(5, (e.findBuff(key)?.data.count ?? 0) + 1);
      b.addBuff(e, { key, source: u, data: { count } });
    }
    resolveHit(b, u, plain(p), e, info, e.x, e.y);
  }
}
function beginCarnelian(b, u) {
  // SkillRuntime has consumed the ordinary first charge before onStart. The
  // original judge tests two available charges, then clears *all* stored SP.
  u.mem.carnelianCharged = u.skill.charges >= 1;
  u.skill.charges = 0; u.skill.sp = 0;
  const bb = u.def.skill.bb, t = u.def.talents.find(t => t.bb.heal_scale != null)?.bb;
  if (t) b.heal(u, u, u.s.maxHp * t[u.mem.carnelianCharged ? 'billro_t_1[enhance].heal_scale' : 'heal_scale']);
  if (u.skill.id === 'skchr_billro_2' && u.mem.carnelianCharged)
    b.addBuff(u, { key: 'carnelian:charged-atk', source: u, mods: { atkPct: bb.atk } });
  u.mem.regularFormVisual = { clip: u.mem.carnelianCharged ? 'Skill_2_Idle' : 'Skill_Idle', loop: true };
  u.mem.carnelianRamp = 0;
  if (u.skill.id === 'skchr_billro_3') b.addBuff(u, { key: 'carnelian:ramp', source: u, mods: { atkPct: 0 } });
  syncCarnelian(b, u);
}
function endCarnelian(b, u) {
  b.removeBuff(u, 'carnelian:charged-atk'); b.removeBuff(u, 'carnelian:ramp');
  u.mem.carnelianCharged = false; u.mem.regularFormVisual = null;
  syncCarnelian(b, u);
}
function nextChainTarget(b, u, previous, seen, p) {
  return b.enemiesInRadius(previous.x, previous.y, 1.7)
    .filter(e => !seen.has(e.id) && canTargetEnemy(u, e, p))
    .sort((a, z) => Math.hypot(a.x - previous.x, a.y - previous.y)
      - Math.hypot(z.x - previous.x, z.y - previous.y) || a.spawnSeq - z.spawnSeq)[0];
}
function passengerChain(b, u, target, p, info, { count, slow, scale = 1, cachedAtk = null }) {
  const seen = new Set(); let hit = target;
  for (let index = 0; hit && index < count; index++) {
    seen.add(hit.id);
    if (hit.alive) b.applyStatus(hit, 'sluggish', { source: u, duration: slow });
    const falloff = scale * Math.pow(.85, index);
    if (cachedAtk == null) resolveHit(b, u, { ...plain(p), atkScale: (p.atkScale ?? 1) * falloff }, hit, info, hit.x, hit.y);
    else b.dealDamage(u, hit, { amount: cachedAtk * falloff, type: 'arts', isAttack: true,
      isSkill: true, isProjectile: true, attackId: info.attackId, applyWay: 'ranged', tags: ['passenger:storm'] });
    const previous = hit; hit = nextChainTarget(b, u, previous, seen, p);
    if (hit && index + 1 < count) b._ev(['atk', previous.id, hit.id, 'chain']);
  }
}
function passengerLaunch(b, u, p, target, info) {
  const bb = u.def.skill.bb, trait = u.def.traitBb;
  const s1 = info.isSkill && u.skill.id === 'skchr_pasngr_1';
  const s2 = info.isSkill && u.skill.id === 'skchr_pasngr_2';
  let projectile;
  projectile = b.addProjectile({ from: u, target, source: u, speed: 15, visual: 'chain',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      u.mem.passengerProjectiles.delete(projectile);
      if (!e || !canTargetEnemy(u, e, p)) return;
      passengerChain(b, u, e, p, info, {
        count: s1 ? bb['pasngr_s_1.max_target'] : s2 ? bb['attack@max_target'] : trait['attack@max_target'],
        slow: s1 ? bb['pasngr_s_1.sluggish'] : trait['attack@sluggish'],
        scale: s1 ? bb['pasngr_s_1.atk_scale'] : 1 });
    } });
  u.mem.passengerProjectiles.add(projectile);
}
function stormTargets(b, u) {
  const keys = absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir);
  const list = b.enemiesInKeys(keys, u, { canHitFly: true });
  // Native postFilter15 is retained. Global skill text identifies the highest
  // HP enemy; this adapter uses current HP, with stable native ties unverified.
  list.sort((a, z) => z.hp - a.hp || a.spawnSeq - z.spawnSeq); return list;
}
function passengerStorm(b, u, point, cachedAtk) {
  const seq = u.deploySeq, bb = u.def.skill.bb, born = b.time;
  const keys = absoluteRangeKeys(evidence.ranges['x-1'], Math.round(point.y), Math.round(point.x), 'RIGHT');
  let tick = 0;
  const timer = b.every(bb.interval, () => {
    if (!live(u) || u.deploySeq !== seq || b.time > born + bb.projectile_delay_time + 1e-9) { timer.cancel(); return; }
    const first = b.rng.pick(b.enemiesInKeys(keys, u, { canHitFly: true }));
    if (first) passengerChain(b, u, first, { canHitFly: true }, { isSkill: true, attackId: ++b._attackSeq },
      { count: bb['chain.max_target'], slow: bb.sluggish, scale: bb.atk_scale, cachedAtk });
    if (++tick >= Math.round(bb.projectile_delay_time / bb.interval)) timer.cancel();
  }, { owner: u });
  u.mem.passengerStorms.add(timer);
  b.after(bb.projectile_delay_time + .3, () => { timer.cancel(); u.mem.passengerStorms.delete(timer); }, { owner: u });
}
function castPassengerStorm(b, u) {
  const target = stormTargets(b, u)[0]; if (!target) return;
  const seq = u.deploySeq, activation = u.skill.activations, point = { x: target.x, y: target.y };
  const duration = model(u).durations.Skill3 / playback(u), event = model(u).hits.Skill3[0] / playback(u);
  const key = 'passenger:cast'; let interrupted = false;
  u.mem.regularFormVisual = { clip: 'Skill3', loop: false };
  b.addBuff(u, { key, duration, flags: { disarm: true, noSp: true } });
  const controlEpoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.canAct
    && u.attackControlEpoch === controlEpoch;
  const watcher = b.on('tick', () => { if (!valid()) interrupted = true; }, { owner: u });
  b.after(event, () => {
    b.off(watcher); if (interrupted || !valid()) return;
    // Original destination3/reuse-input allows the recorded point even after
    // the selected enemy dies or disappears during the cast.
    const destination = canTargetEnemy(u, target, { canHitFly: true }) ? { x: target.x, y: target.y } : point;
    passengerStorm(b, u, destination, u.s.atk * u.s.atkScaleMul);
  }, { owner: u });
  b.after(duration, () => {
    b.off(watcher); b.removeBuff(u, key);
    if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function syncPassengerAlone(b, u) {
  const t = u.def.talents.find(t => t.bb.atk != null)?.bb;
  const keys = new Set(absoluteRangeKeys(evidence.ranges['x-5'], u.tileR, u.tileC, 'RIGHT'));
  const alone = live(u) && t && !b.enemies.some(e => live(e) && bodyInKeys(e, keys));
  if (!alone) b.removeBuff(u, 'passenger:alone');
  else if (!u.findBuff('passenger:alone')) b.addBuff(u, { key: 'passenger:alone', source: u, mods: { atkPct: t.atk } });
}

export function customizeCasterSecondKit({ battle: b, id, def, unit: u, kit }) {
  if (!CASTER_SECOND_OPERATORS[id]) return;
  kit.install = null; const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', hits: 1, hitsFn: null,
    dmgMul: null, chain: null, splashRadius: 0, maxTargets: 1, rangeAoe: false, allInRange: false,
    canHitFly: true, interruptOnSkillChange: true, install: null };
  if (id === CAR) {
    kit.trait.noAttack = true; kit.trait.launchAttack = carnelianLaunch;
    kit.skill = { kind: 'duration', duration: s.duration, charges: 2,
      mods: s.id.endsWith('_1') ? { atkPct: bb.atk, defPct: bb.def }
        : s.id.endsWith('_2') ? { batFlat: bb.base_attack_time } : {},
      targeting: s.rangeGrid ? { rangeGrid: s.rangeGrid } : {},
      attack: { noAttack: false, attackVisual: (_battle, unit) => unit.mem.carnelianCharged ? 'Skill_2_Loop' : 'Skill_Loop',
        windup: windup(unit => unit.mem.carnelianCharged ? 'Skill_2_Loop' : 'Skill_Loop') },
      onStart: () => beginCarnelian(b, u), onEnd: () => endCarnelian(b, u),
      onTick: ({ skill }) => {
        if (s.id !== 'skchr_billro_3') return;
        const elapsed = Math.floor(s.duration - skill.timeLeft + 1e-8);
        if (elapsed === u.mem.carnelianRamp) return;
        u.mem.carnelianRamp = elapsed;
        b.addBuff(u, { key: 'carnelian:ramp', source: u,
          mods: { atkPct: bb.atk * Math.min(1, elapsed / (s.duration - 1)) } });
      } };
  } else {
    Object.assign(kit.trait, { attackVisual: 'Attack', windup: windup('Attack'), launchAttack: passengerLaunch,
      canAttack: (_battle, unit) => !unit.mem.passengerProjectiles.size });
    if (s.id.endsWith('_1')) kit.skill = { kind: 'charges', trigger: { rule: 'DEFAULT' }, attack: {} };
    else if (s.id.endsWith('_2')) kit.skill = { kind: 'duration', duration: s.duration,
      mods: { atkPct: bb.atk, batPct: bb.base_attack_time, rangeExtend: bb.ability_range_forward_extend },
      targeting: { rangeGrid: def.rangeGrid },
      attack: { attackVisual: 'Skill2', windup: windup('Skill2') },
      onStart: () => { u.mem.regularFormVisual = { clip: 'Skill2_Idle', loop: true }; },
      onEnd: () => { u.mem.regularFormVisual = null; } };
    else kit.skill = { kind: 'instant', charges: 2, canActivate: () => !u.findBuff('passenger:cast') && stormTargets(b, u).length > 0,
      onStart: () => castPassengerStorm(b, u) };
  }
}
export function installCasterSecond({ battle: b, unit: u, def }) {
  if (!CASTER_SECOND_OPERATORS[def.charId]) return;
  if (def.charId === CAR) {
    u.mem.carnelianCharged = false;
    const sync = () => syncCarnelian(b, u);
    b.every(.2, sync, { owner: u }); b.on('deploy', ({ unit }) => { if (unit === u) sync(); }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (source !== u || target.side !== 'enemy' || !dmg.isAttack) return;
      const count = target.findBuff(`carnelian:stack:${u.id}`)?.data.count;
      if (count && target.findBuff(`carnelian:mark:${u.id}`)) dmg.mul *= 1 + count * u.def.skill.bb['attack@damage_scale'];
    }, { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) endCarnelian(b, u); }, { owner: u });
  } else {
    u.mem.passengerProjectiles = new Set(); u.mem.passengerStorms = new Set();
    const t = def.talents.find(t => t.bb.hp_ratio != null)?.bb;
    if (t) b.on('hit', ({ source, target, dmg }) => {
      if (source !== u || target?.side !== 'enemy' || !dmg.isAttack) return;
      const key = `passenger:analysis:${u.id}`;
      if (target.hpRatio + 1e-9 >= t.hp_ratio) b.addBuff(target, { key, source: u,
        duration: t['pasngr_t_1[enhance].duration'] });
      if (target.findBuff(key)) dmg.mul *= t['pasngr_t_1[enhance].damage_scale'];
    }, { owner: u });
    b.on('tick', () => {
      for (const p of u.mem.passengerProjectiles) if (!b.projectiles.list.includes(p)) u.mem.passengerProjectiles.delete(p);
    }, { owner: u });
    b.every(.2, () => syncPassengerAlone(b, u), { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) {
      for (const timer of u.mem.passengerStorms) timer.cancel();
      u.mem.passengerStorms.clear(); b.removeBuff(u, 'passenger:alone');
    } }, { owner: u });
  }
}
