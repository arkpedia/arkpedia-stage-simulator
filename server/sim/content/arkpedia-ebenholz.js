// SPDX-License-Identifier: GPL-3.0-or-later
// Counts/selectors/ranks/original clips are retained in the evidence JSON.
// Charge FSM transfer and token ATK inheritance are bounded policies, not recovered C#.
import evidence from '../../../data/arkpedia-ebenholz-prefabs.json' with { type: 'json' };
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { COLS } from '../constants.js';
const ID = 'char_4046_ebnhlz', TOKEN = 'token_10024_ebnhlz_rcube';
const air = { canHitFly: true }, ground = { canHitFly: false };
const live = u => u?.alive && u.deployed && !u.hidden;
const exists = u => u?.alive && u.deployed;
const elite = e => ['ELITE', 'BOSS'].includes(e.def.rank);
const mode = u => u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const clip = u => mode(u) === 1 ? 'Skill_1_Loop' : mode(u) === 3 ? 'Skill_3_A' : 'Attack';
const rate = u => Math.min(1, u.s.aspd / 100);
function targets(b, u) {
  const es = b.enemiesInKeys(u.rangeKeys, u, air).filter(e => mode(u) !== 3 || elite(e));
  sortEnemyTargets(b, u, es); return es;
}
function clearChargeVisual(u) {
  if (u.mem.ebnhlzCharging) { u.mem.ebnhlzCharging = false; u.mem.regularFormVisual = null; }
}
function projectile(b, u, e, scale, talent, info, tag) {
  b.addProjectile({ from: { x: u.x, y: u.y }, source: u, target: e, speed: 10, maxAge: 10,
    visual: 'bolt', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (!target || !canTargetEnemy(u, target, air)) return;
      const atk = u.s.atk * u.s.atkScaleMul;
      // Isolation checks current enemy centres; devices are not members of b.enemies.
      const isolated = talent && !b.enemies.some(other => other !== target && live(other)
        && !other.s.flags.untargetable && Math.hypot(other.x - target.x, other.y - target.y) <= talent.range_radius);
      // Native active/passive buff versus primary-damage dispatch order is not
      // executable here. Apply the isolated add-on first, once per emitted shot.
      if (isolated) b.dealDamage(u, target, { amount: atk * talent.atk_scale, type: 'arts',
        applyWay: 'none', isAttack: true, isSkill: info.isSkill, isProjectile: true,
        attackId: info.attackId, tags: ['ebnhlz:isolated'] });
      if (canTargetEnemy(u, target, air)) b.dealDamage(u, target, { amount: atk * scale,
        type: 'arts', applyWay: 'ranged', isAttack: true, isSkill: info.isSkill,
        isProjectile: true, attackId: info.attackId, tags: [tag] });
    } });
}
function launch(b, u, _p, e, info) {
  clearChargeVisual(u);
  if (!canTargetEnemy(u, e, air) || mode(u) === 3 && !elite(e)) return;
  const m = mode(u), t1 = u.def.talents.find(t => t.bb.times_2 != null)?.bb;
  const t2 = u.def.talents.find(t => t.bb.range_radius != null)?.bb;
  const coefficient = m === 1 ? u.skill.bb['attack@atk_scale'] : 1;
  const storedScale = (t1?.atk_scale ?? 1) * coefficient
    * (m === 3 ? u.skill.bb.talent_scale_multiplier : 1);
  const regular = u.mem.ebnhlzStored, extra = elite(e) ? u.mem.ebnhlzExtra : 0;
  // Transfer shared storage between modes; take only successfully emitted charges.
  u.mem.ebnhlzStored = 0; if (extra) u.mem.ebnhlzExtra = 0; u.mem.ebnhlzAcc = 0;
  projectile(b, u, e, coefficient, t2, info, 'ebnhlz:main');
  for (let i = 0; i < regular + extra; i++) projectile(b, u, e, storedScale, t2, info, 'ebnhlz:stored');
}
function tiles(b, u) {
  return u.rangeKeys.filter(key => {
    const r = Math.floor(key / COLS), c = key % COLS, t = b.grid.tile(r, c);
    return b.grid.inRect(r, c) && t && t.build !== 'NONE' && t.pass !== 'NONE'
      && !b.downOn(r, c) && !b.allyUnits.some(a => exists(a) && a.tileR === r && a.tileC === c);
  });
}
function selectTiles(b, u, count) {
  const es = b.enemies.filter(e => canTargetEnemy(u, e, ground));
  const pool = tiles(b, u).map(key => ({ key, tie: b.rng(), x: key % COLS, y: Math.floor(key / COLS) }));
  const cost = t => {
    const on = es.filter(e => Math.round(e.x) === t.x && Math.round(e.y) === t.y);
    if (on.length) return [0, -Math.max(...on.map(e => e.s.taunt || 0))];
    return [1, es.length ? Math.min(...es.map(e => Math.hypot(e.x - t.x, e.y - t.y))) : 0];
  };
  pool.sort((a, z) => { const ac = cost(a), zc = cost(z); return ac[0] - zc[0] || ac[1] - zc[1] || a.tie - z.tie || a.key - z.key; });
  return pool.slice(0, count).map(t => t.key);
}
function tokenRecord(b, u) {
  const raw = b.data.raw.tokens[TOKEN], build = u.def.raw.arkpedia, phase = raw.phases[build.elite];
  return { id: TOKEN, name: raw.name, profession: raw.profession, subProfessionId: raw.subProfessionId,
    position: raw.position, stats: { ...phase.attributesKeyFrames.at(-1).data,
      atk: u.s.atk * u.s.atkScaleMul, attackSpeed: 100, blockCnt: 0 }, rangeGrid: phase.rangeGrid,
    skill: null, talents: [], avatar: raw.avatar, arkpedia: { ...build } };
}
function remnant(b, u, key, bb) {
  const t = b.spawnToken(u, TOKEN, Math.floor(key / COLS), key % COLS,
    { dir: 'RIGHT', def: tokenRecord(b, u), kit: { skill: null,
      trait: { noAttack: true, attack: 'ranged', dmgType: 'arts', projectile: 'none',
        canHitFly: false, hits: 1, maxTargets: 1, splashRadius: 0, chain: null },
      install: (_b, a) => { a.kind = 'device'; a.deploymentSlotCost = 0; } } });
  if (!t) return false;
  u.mem.ebnhlzRemnants.add(t);
  const born = b.time + 1, expires = b.time + 30, ownerSeq = u.deploySeq;
  let triggered = false;
  const remove = () => { if (exists(t)) b.retreat(t, { permanent: true, reason: 'remnant-finished' });
    u.mem.ebnhlzRemnants.delete(t); };
  const watch = b.every(b.dt, () => {
    if (!exists(t)) { watch.cancel(); u.mem.ebnhlzRemnants.delete(t); return; }
    if (!live(u) || u.deploySeq !== ownerSeq || b.time + 1e-9 >= expires) { remove(); watch.cancel(); return; }
    if (triggered || b.time + 1e-9 < born || !t.canAct) return;
    const list = b.enemiesInRadius(t.x, t.y, 1.350000023841858).filter(e => canTargetEnemy(t, e, ground));
    if (!list.length) return;
    triggered = true; t.mem.regularFormVisual = { clip: 'Attack', loop: false };
    const epoch = t.attackControlEpoch, attackId = ++b._attackSeq;
    b.after(.9300000071525574, () => {
      if (!live(t) || !live(u) || u.deploySeq !== ownerSeq || !t.canAct || t.attackControlEpoch !== epoch) { remove(); return; }
      // Retained INPUT set: no late entrants are substituted during the fuse.
      for (const e of list) if (canTargetEnemy(t, e, ground)) {
        b.pull(e, bb.force, { to: { x: t.x, y: t.y }, center: t });
        b.dealDamage(t, e, { amount: t.s.atk * t.s.atkScaleMul * bb.atk_scale, type: 'arts',
          applyWay: 'melee', isAttack: true, isSkill: true, attackId, tags: ['ebnhlz:remnant'] });
      }
      t.stats.attacks++; b.emit('attack', { attacker: t, targets: list, isSkill: true }); remove();
    }, { owner: t });
  });
  return true;
}
function summonCast(b, u) {
  clearChargeVisual(u); const state = {}, seq = u.deploySeq;
  const available = selectTiles(b, u, 1 + u.mem.ebnhlzStored + u.mem.ebnhlzExtra), bb = { ...u.skill.bb };
  u.mem.ebnhlzCast = state; u.mem.regularFormVisual = { clip: 'Skill_2', loop: false };
  b.addBuff(u, { key: 'ebnhlz:cast', flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.mem.ebnhlzCast === state
    && u.canAct && u.attackControlEpoch === epoch;
  // The native cast reads INPUT tiles at startup. Occupied tiles at release fail
  // without replacement; the bounded consumption policy counts successful spawns.
  b.after(model(u).hits.Skill_2[0] / (u.s.aspd / 100), () => {
    if (!valid()) return;
    let made = 0;
    for (const key of available) if (tiles(b, u).includes(key) && remnant(b, u, key, bb)) made++;
    let consumed = Math.max(0, made - 1), ex = Math.min(consumed, u.mem.ebnhlzExtra);
    u.mem.ebnhlzExtra -= ex; consumed -= ex;
    u.mem.ebnhlzStored = Math.max(0, u.mem.ebnhlzStored - consumed); u.mem.ebnhlzAcc = 0;
  }, { owner: u });
  b.after(model(u).durations.Skill_2 / (u.s.aspd / 100), () => {
    if (u.deploySeq !== seq || u.mem.ebnhlzCast !== state) return;
    b.removeBuff(u, 'ebnhlz:cast'); u.mem.ebnhlzCast = null; u.mem.regularFormVisual = null; u.atkCd = 0;
  }, { owner: u });
}
function switchMode(b, u, begin) {
  clearChargeVisual(u); u.mem.ebnhlzAcc = 0; u.atkCd = 0;
  if (Number(u.skill.id.at(-1)) !== 1) return;
  const name = begin ? 'Skill_1_Begin' : 'Skill_1_End', state = {};
  u.mem.ebnhlzTransition = state; u.mem.regularFormVisual = { clip: name, loop: false };
  b.after(model(u).durations[name], () => {
    if (!live(u) || u.mem.ebnhlzTransition !== state) return;
    u.mem.ebnhlzTransition = null; u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeEbenholzKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', dmgType: 'arts', applyWay: 'ranged', ...air,
    maxTargets: 1, hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0, chain: null,
    allInRange: false, hitAllBlocked: false, launchAttack: launch, interruptOnSkillChange: true,
    acquireTargets: () => targets(b, u).slice(0, 1),
    canAttack: () => !u.mem.ebnhlzTransition && !u.mem.ebnhlzCast,
    attackVisual: () => { clearChargeVisual(u); return clip(u); },
    windup: () => model(u).hits[clip(u)][0] / rate(u) };
  const s = def.skill, k = Number(s.id.at(-1));
  if (k === 2) kit.skill = { kind: 'instant', trigger: 'SP_FULL',
    canActivate: () => !u.mem.ebnhlzCast && tiles(b, u).length > 0, onStart: () => summonCast(b, u) };
  else kit.skill = { kind: 'duration', duration: s.duration, attack: {},
    ...(k === 1 ? { mods: { batMul: s.bb.base_attack_time }, targeting: { rangeGrid: s.rangeGrid } }
      : { mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed }, manualCancel: true,
        defaultCondition: () => targets(b, u).some(elite) }),
    onStart: () => switchMode(b, u, true), onEnd: () => switchMode(b, u, false) };
}
export function installEbenholz({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const cap = def.traitBb.times ?? 3, extra = def.talents.find(t => t.bb.times_2 != null)?.bb.times_2 ?? 0;
  u.mem.ebnhlzRemnants = new Set();
  const reset = () => { for (const t of u.mem.ebnhlzRemnants) if (exists(t)) b.retreat(t, { permanent: true, reason: 'owner-finished' });
    u.mem.ebnhlzRemnants.clear(); u.mem.ebnhlzStored = 0; u.mem.ebnhlzExtra = 0;
    u.mem.ebnhlzAcc = 0; u.mem.ebnhlzCast = null; u.mem.ebnhlzTransition = null; clearChargeVisual(u); };
  reset();
  b.on('deploy', ({ unit }) => { if (unit === u) reset(); }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) reset(); }, { owner: u });
  b.on('retreat', ({ unit }) => { if (unit === u) reset(); }, { owner: u });
  b.on('tick', ({ dt }) => {
    if (!live(u) || !u.canAct || u.s.flags.disarm || u.mem.ebnhlzTransition || u.mem.ebnhlzCast) return;
    if (targets(b, u).length) { u.mem.ebnhlzAcc = 0; clearChargeVisual(u); return; }
    if (u.mem.ebnhlzStored >= cap && u.mem.ebnhlzExtra >= extra) { clearChargeVisual(u); return; }
    u.mem.ebnhlzAcc += dt;
    if (!u.mem.ebnhlzCharging) {
      u.mem.ebnhlzCharging = true;
      u.mem.regularFormVisual = { clip: mode(u) === 1 ? 'Skill_1_Charge' : mode(u) === 3 ? 'Skill_3_Charge' : 'Attack_Charge', loop: true };
    }
    while (u.mem.ebnhlzAcc + 1e-9 >= u.s.interval && (u.mem.ebnhlzStored < cap || u.mem.ebnhlzExtra < extra)) {
      u.mem.ebnhlzAcc -= u.s.interval;
      if (u.mem.ebnhlzStored < cap) u.mem.ebnhlzStored++; else u.mem.ebnhlzExtra++;
    }
  }, { owner: u });
}
