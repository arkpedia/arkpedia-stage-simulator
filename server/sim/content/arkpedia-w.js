// SPDX-License-Identifier: GPL-3.0-or-later
import { W_OPERATORS } from '../../../shared/arkpedia/w-operators.js';
import evidence from '../../../data/arkpedia-w-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';

const ID = 'char_113_cqbw', TOKEN = 'token_10008_cqbw_box';
const live = u => u?.alive && u.deployed && !u.hidden;
const exists = u => u?.alive && u.deployed;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const plain = p => ({ ...p, splashRadius: 0, chain: null, hits: 1, hitsFn: null, dmgMul: null });
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const clip = u => u.skill?.pending && u.skill.id === 'skchr_cqbw_2' ? 'Skill_2' : 'Attack';
function syncInjury(b, u) {
  const t = u.def.talents.find(t => t.bb.damage_scale != null)?.bb;
  const key = `w:physical:${u.id}`;
  for (const e of b.enemies) {
    // Native range aura is enemy/ALL/purposeNONE. Concealment and Sleep are not
    // attack selection here; only source/target existence and target-free gate it.
    const eligible = t && live(u) && live(e) && !e.s.flags.untargetable
      && bodyInKeys(e, u.rangeKeys) && e.s.flags.stun;
    if (!eligible) b.removeBuff(e, key);
    else if (!e.findBuff(key)) b.applyStatus(e, 'physFragile', { key, source: u, value: t.damage_scale - 1 });
  }
}
function victims(b, u, x, y, radius, ground = false) {
  return b.enemiesInRadius(x, y, radius).filter(e => canTargetEnemy(u, e,
    { canHitFly: !ground, ignoreCamouflage: true }));
}
function explode(b, u, list, p, info, stun = 0, cachedAtk = null) {
  for (const e of list) {
    if (!canTargetEnemy(u, e, { canHitFly: p.canHitFly, ignoreCamouflage: true })) continue;
    if (stun > 0) b.applyStatus(e, 'stun', { source: u, duration: stun });
    // Source active Stun precedes our same-impact damage, explicitly bounded
    // because the native activeBuff/damage dispatch order is not recovered.
    syncInjury(b, u);
    if (cachedAtk == null) resolveHit(b, u, plain(p), e, info, e.x, e.y);
    else b.dealDamage(u, e, { amount: cachedAtk * (p.atkScale ?? 1), type: 'phys',
      applyWay: 'ranged', isAttack: true, isSkill: info.isSkill,
      isProjectile: !!info.isProjectile, attackId: info.attackId });
  }
}
function ordinary(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  return b.addProjectile({ source: u, from: u, target: e, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && canTargetEnemy(u, target, p)) explode(b, u,
        victims(b, u, target.x, target.y, 1), p, { ...info, isProjectile: true });
    } });
}
function targets(b, u, highestHp = false, max = 1) {
  const list = b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true });
  sortEnemyTargets(b, u, list);
  if (highestHp) list.sort((a, z) => z.hp - a.hp);
  return list.slice(0, max);
}
function cast(b, u, third) {
  const s = u.def.skill, bb = s.bb, seq = u.deploySeq, act = u.skill.activations;
  const anim = third ? 'Skill_3' : 'Skill_1', key = `w:cast:${u.id}`;
  const r = third ? 1 : rate(u), event = model(u).hits[anim][0] / r;
  const full = model(u).durations[anim] / r;
  const pending = { released: false, cancelled: false, projectiles: [] };
  u.mem.wCast = pending;
  u.mem.regularFormVisual = { clip: anim, loop: false };
  b.addBuff(u, { key, flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && !pending.cancelled;
  const unborn = () => valid() && u.canAct && u.attackControlEpoch === epoch;
  const stop = () => {
    pending.cancelled = true; b.removeBuff(u, key);
    if (u.deploySeq === seq && u.skill.activations === act) u.mem.regularFormVisual = null;
  };
  const finish = () => { if (u.deploySeq === seq) b.removeBuff(u, key);
    if (u.deploySeq === seq && u.skill.activations === act) u.mem.regularFormVisual = null; };
  const watch = b.every(b.dt, () => {
    if (!pending.released) { if (!unborn()) { stop(); watch.cancel(); } return; }
    if (!valid()) { watch.cancel(); return; }
    if (!third && pending.projectiles.every(p => !b.projectiles.list.includes(p))) { finish(); watch.cancel(); }
  }, { owner: u });
  b.after(event, () => {
    if (!unborn()) { stop(); watch.cancel(); return; }
    pending.released = true;
    const info = { isSkill: true, isProjectile: true, attackId: ++b._attackSeq };
    const list = targets(b, u, third, third ? bb.max_target : 1);
    u.stats.attacks++; b.emit('attack', { attacker: u, targets: list, isSkill: true });
    if (third) {
      for (const e of list) attachBomb(b, u, e, bb, info);
      // No waitProjectileInvalid: retain only the bounded original cast clip,
      // while already born unmanaged bombs have an independent three-second clock.
      b.after(Math.max(0, full - event), () => { finish(); watch.cancel(); }, { owner: u });
    } else if (list.length) {
      pending.projectiles.push(b.addProjectile({ source: u, from: u, target: list[0],
        speed: 8, maxAge: 10, visual: 'arrow', data: { arkpediaTrackedVisual: true },
        onHit: ({ target }) => {
          if (target && canTargetEnemy(u, target, { canHitFly: true })) explode(b, u,
            victims(b, u, target.x, target.y, 1.2), { ...plain(u.profile), atkScale: bb.atk_scale }, info, bb.stun);
        } }));
    } else { finish(); watch.cancel(); }
  }, { owner: u });
}
function attachBomb(b, u, target, bb, info) {
  const seq = target.deploySeq, atk = u.s.atk * u.s.atkScaleMul;
  const bomb = { target, seq, x: target.x, y: target.y, until: b.time + 3, done: false };
  u.mem.wBombs.add(bomb);
  const detonate = () => {
    if (bomb.done) return;
    bomb.done = true; watch.cancel(); u.mem.wBombs.delete(bomb);
    explode(b, u, victims(b, u, bomb.x, bomb.y, 1.2),
      { ...plain(u.profile), canHitFly: true, atkScale: bb.atk_scale }, info, bb.stun, atk);
  };
  // Static keepUpdate1/stopIfDead1/stopIfDisappeared1/onlyCheckHitWhenStop1
  // are mapped to a retained location and one Stop blast, including early Stop.
  // Native delayed mover versus .5 lifetime phase remains explicit in evidence.
  const watch = b.every(b.dt, () => {
    if (exists(target) && !target.hidden && target.deploySeq === seq) {
      bomb.x = target.x; bomb.y = target.y;
    } else { detonate(); return; }
    if (b.time + 1e-9 >= bomb.until) detonate();
  });
}
function mineTiles(b, u) {
  return u.rangeKeys.filter(key => {
    const r = Math.floor(key / COLS), c = key % COLS, tile = b.grid.tile(r, c);
    return b.grid.inRect(r, c) && tile && tile.build !== 'NONE' && tile.pass !== 'NONE'
      && !b.downOn(r, c) && !b.allyUnits.some(a => exists(a) && a.tileR === r && a.tileC === c);
  });
}
function mineRecord(b, u) {
  const raw = b.data.raw.tokens[TOKEN];
  if (!raw) throw Error('Missing reviewed W mine source');
  const build = u.def.raw.arkpedia, phase = raw.phases[build.elite];
  // Native base mine ATK100 is not a recovered owner-inheritance formula. The
  // selected owner's current raw ATK is explicitly sampled at placement to
  // represent the Global skill's ATK-based damage; this boundary is tested.
  return { id: TOKEN, name: raw.name, profession: raw.profession, subProfessionId: raw.subProfessionId,
    position: raw.position, stats: { ...phase.attributesKeyFrames.at(-1).data, atk: u.s.atk,
      attackSpeed: 100, blockCnt: 0 }, rangeGrid: phase.rangeGrid,
    skill: null, talents: [], avatar: raw.avatar, arkpedia: { ...build } };
}
function spawnMine(b, u, key, bb, info) {
  const r = Math.floor(key / COLS), c = key % COLS;
  const t = b.spawnToken(u, TOKEN, r, c, { dir: 'RIGHT', def: mineRecord(b, u),
    kit: { skill: null, trait: { noAttack: true, attack: 'ranged', dmgType: 'phys', projectile: 'none',
      canHitFly: false, hits: 1, maxTargets: 1, splashRadius: 0, chain: null },
      install: (_battle, token) => { token.kind = 'device'; token.deploymentSlotCost = 0; } } });
  if (!t) return;
  u.mem.wMines.add(t);
  const born = b.time + .5, expires = b.time + 120;
  let triggered = false, pending = false;
  const remove = () => { if (exists(t)) b.retreat(t, { permanent: true, reason: 'mine-finished' }); };
  const watcher = b.every(b.dt, () => {
    if (!exists(t)) { watcher.cancel(); u.mem.wMines.delete(t); return; }
    if (!live(u) || b.time + 1e-9 >= expires) { remove(); watcher.cancel(); u.mem.wMines.delete(t); return; }
    if (triggered || b.time + 1e-9 < born) return;
    const list = victims(b, t, t.x, t.y, 1.35, true);
    if (!list.length) return;
    triggered = pending = true;
    t.mem.regularFormVisual = { clip: 'Attack', loop: false };
    const epoch = t.attackControlEpoch;
    b.after(1.5, () => {
      if (!pending || !exists(t) || !live(u) || !t.canAct || t.attackControlEpoch !== epoch) { remove(); return; }
      // Native selector timing1 is retained as the original input set. No new
      // enemy is substituted during the explicit 1.5s fuse.
      explode(b, t, list, { ...plain(t.profile), canHitFly: false, atkScale: bb.atk_scale },
        { ...info, isProjectile: false }, bb.stun);
      t.stats.attacks++; b.emit('attack', { attacker: t, targets: list, isSkill: true });
      remove();
    }, { owner: t });
  });
  b.on('death', ({ unit }) => { if (unit === t) { pending = false; u.mem.wMines.delete(t); watcher.cancel(); } }, { owner: t });
}
function mineAcquire(b, u, p) {
  if (u.skill?.id !== 'skchr_cqbw_2') return null;
  if (u.skill.pending) return u.mem.wMineTile != null ? [u] : [];
  if (u.skill.ready && !u.skill.active && mineTiles(b, u).length) return [u];
  return null;
}
function launch(b, u, p, target, info) {
  if (info.isSkill && u.skill.id === 'skchr_cqbw_2') {
    const key = u.mem.wMineTile; u.mem.wMineTile = null;
    if (key != null && mineTiles(b, u).includes(key)) spawnMine(b, u, key, u.skill.bb, info);
    return;
  }
  return ordinary(b, u, p, target, info);
}
export function customizeWKit({ battle: b, id, def, unit: u, kit }) {
  if (!W_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    hits: 1, hitsFn: null, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    splashRadius: 0, rangeAoe: false, allInRange: false, chain: null, dmgMul: null, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true, launchAttack: launch,
    acquireTargets: mineAcquire, attackVisual: (_b, unit) => clip(unit),
    windup: (_b, unit) => model(unit).hits[clip(unit)][0] / (clip(unit) === 'Attack' ? rate(unit) : 1) };
  const s = def.skill;
  if (s.id === 'skchr_cqbw_2') kit.skill = { kind: 'instant', attack: { retargetOnRelease: false },
    defaultCondition: (battle, unit) => mineTiles(battle, unit).length > 0,
    canActivate: () => mineTiles(b, u).length > 0,
    onStart: () => { u.mem.wMineTile = b.rng.pick(mineTiles(b, u)); b.addBuff(u, { key: 'w:mine-cast', flags: { noSp: true } }); },
    onEnd: () => { u.mem.wMineTile = null; b.removeBuff(u, 'w:mine-cast'); } };
  else kit.skill = { kind: 'instant', onStart: () => cast(b, u, s.id === 'skchr_cqbw_3') };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installW({ battle: b, unit: u, def }) {
  if (!W_OPERATORS[def.charId]) return;
  u.mem.wMines = new Set(); u.mem.wBombs = new Set(); u.mem.wMineTile = null;
  const t = def.talents.find(t => t.bb.prob != null)?.bb;
  if (t) {
    b.on('deploy', ({ unit }) => {
      if (unit !== u) return;
      const seq = u.deploySeq;
      b.after(t.interval, () => { if (live(u) && u.deploySeq === seq) b.addBuff(u,
        { key: 'w:ambush', source: u, mods: { dodgePhys: t.prob, dodgeArts: t.prob, taunt: t.taunt_level } }); },
        { owner: u });
    }, { owner: u });
  }
  // Evaluate native conditional incoming Physical scale against the live stun
  // state even when another producer changes it in this same simulation frame.
  b.on('hit', () => syncInjury(b, u), { owner: u });
  for (const event of ['tick', 'deploy', 'death']) b.on(event, () => {
    if (!live(u)) for (const t of u.mem.wMines) if (exists(t)) b.retreat(t, { permanent: true, reason: 'owner-finished' });
    syncInjury(b, u);
  }, { owner: u });
  syncInjury(b, u);
}
