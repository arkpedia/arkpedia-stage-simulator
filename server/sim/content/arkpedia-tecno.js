// SPDX-License-Identifier: GPL-3.0-or-later
// Original selectors/templates, clocks and compiled-controller bounds are
// retained in arkpedia-tecno-prefabs.json; native particles are not invented.
import evidence from '../../../data/arkpedia-tecno-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { canTargetEnemy, enemyStealthed, sortEnemyTargets } from '../targeting.js';
import { resolveHit } from '../ai.js';
import { COLS } from '../constants.js';
const ID = 'char_4164_tecno', TOKEN = 'token_10042_tecno_puppet';
const exists = u => u?.alive && u.deployed;
const second = u => u.skill?.active && u.skill.id === 'skchr_tecno_2';
const first = u => u.skill?.active && u.skill.id === 'skchr_tecno_1';
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const speed = u => Math.min(1, u.base.bat / u.s.interval);
const dancers = (b, u) => b.allyUnits.filter(t => t.defId === TOKEN && t.ownerUnit === u && exists(t));
const cap = u => u.def.talents.find(t => t.bb.max_token_cnt)?.bb.max_token_cnt ?? 0;
function healable(b, u, t) {
  const f = t.s.flags;
  return exists(t) && !t.hidden && t.defId === TOKEN && t.ownerUnit === u && t.hp < t.s.maxHp
    && !f.untargetable && !f.noHeal && !t.profile.noHeal && b.allySelectable(t, u);
}
function healTarget(b, u) {
  // Native NecromancerSelector/postFilter16 is compiled. The bounded bridge
  // chooses the lowest HP ratio of this host's injured, in-range dancers.
  return dancers(b, u).filter(t => healable(b, u, t) && bodyInKeys(t, u.rangeKeySet))
    .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq)[0];
}
function healDancer(b, u, t) {
  if (!healable(b, u, t)) return;
  // HealViaMaxHpRatio: source MAX_HP * hp_ratio1, ignoreHealFree and
  // skipModifierEvent. Do not turn this into a Medic/ATK heal pipeline.
  const amount = Math.max(0, Math.min(u.s.maxHp, t.s.maxHp - t.hp));
  t.hp += amount; u.stats.heal += amount;
  const pp = b._pp(u.ownerId); if (pp) pp.healingDone += amount;
  if (amount >= .5) b._ev(['heal', t.id, Math.round(amount)]);
}
function enemies(b, u, p, keys, extra = []) {
  const cands = b.enemies.filter(t => canTargetEnemy(u, t, p)
    && (bodyInKeys(t, keys) || extra.includes(t)));
  return sortEnemyTargets(b, u, cands, p.priority).slice(0, 1);
}
function ownerTargets(b, u, p) {
  const blocked = dancers(b, u).flatMap(t => t.blocking);
  const targets = enemies(b, u, p, u.rangeKeySet, [...u.blocking, ...blocked]);
  // Native union-selector cross-class sorting is unavailable. Prefer enemy
  // damage, then injured own dancer; never heal unrelated operators/tokens.
  return targets.length ? targets : [healTarget(b, u)].filter(Boolean);
}
function launch(b, u, p, t, info) {
  if (t.side === 'ally') { healDancer(b, u, t); return; }
  if (!canTargetEnemy(u, t, p)) return;
  if (u.defId === TOKEN && !second(u.ownerUnit)) {
    if (t.isFlying) return; // selection is at attack start; block may change before the strike
    resolveHit(b, u, { ...p, applyWay: 'melee' }, t, info, t.x, t.y); return;
  }
  b.addProjectile({ from: u, target: t, source: u, speed: 10, maxAge: 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target: a, x, y }) => {
      if (a && canTargetEnemy(u, a, p)) resolveHit(b, u, { ...p, attack: 'ranged', applyWay: 'ranged' }, a, info, x, y);
    } });
}
function legalTile(b, r, c) {
  const tile = b.grid.tile(r, c), occ = b._occ[r * COLS + c];
  return b.grid.inRect(r, c) && tile?.height === 'LOW' && ['MELEE', 'ALL'].includes(tile.build)
    && tile.pass !== 'NONE' && !b.grid.isObstacle(r, c) && !b.downOn(r, c)
    && !(exists(occ));
}
function tokenRecord(b, u) {
  const source = b.data.rawToken(TOKEN), build = u.def.raw.arkpedia;
  if (!source || !build) throw Error('Missing original Puppet Dancer source/build');
  const phase = source.phases[build.elite], low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = high.level === low.level ? 0 : (build.level - low.level) / (high.level - low.level);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + ((high.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return { id: TOKEN, name: source.name, profession: source.profession, position: source.position,
    subProfessionId: source.subProfessionId, stats, rangeGrid: phase.rangeGrid,
    dmgType: 'arts', attackKind: 'melee', canHitFly: false, talents: [] };
}
function syncDancer(b, u, t) {
  const bb = u.def.skill.bb;
  if (first(u)) {
    if (!t.findBuff('tecno:s1')) b.addBuff(t, { key: 'tecno:s1', source: u,
      mods: { hpPct: bb.max_hp, defPct: bb.def, blockCnt: bb.block_cnt } });
  } else b.removeBuff(t, 'tecno:s1');
  if (second(u)) {
    if (!t.findBuff('tecno:s2')) b.addBuff(t, { key: 'tecno:s2', source: u,
      mods: { aspd: bb['tecno_s_2[token][mode].attack_speed'] } });
  } else b.removeBuff(t, 'tecno:s2');
  if (!t.mem.tecnoBorn) t.mem.regularFormVisual = { clip: second(u) ? 'Skill_2_Idle' : 'Idle', loop: true,
    attack: second(u) ? 'Skill_2_Loop' : 'Attack' };
}
function spawn(b, u, r, c) {
  if (!exists(u) || dancers(b, u).length >= cap(u) || !legalTile(b, r, c)) return null;
  return b.spawnToken(u, TOKEN, r, c, { def: tokenRecord(b, u), dir: 'RIGHT', kit: {
    trait: { install: null, attack: 'melee', projectile: 'none', dmgType: 'arts', canHitFly: true,
      hits: 1, maxTargets: 1, splashRadius: 0, chain: null, heal: null,
      acquireTargets: (battle, t, p) => second(u)
        ? enemies(battle, t, p, u.rangeKeySet, t.blocking)
        : t.blocking.filter(e => canTargetEnemy(t, e, { ...p, canHitFly: false })).slice(0, 1),
      canAttack: (_, t) => !t.mem.tecnoBorn,
      windup: (_, t) => model(t).hits[second(u) ? 'Skill_2_Loop' : 'Attack'][0] / speed(t),
      attackVisual: () => second(u) ? 'Skill_2_Loop' : 'Attack',
      attackEpoch: () => `${u.deploySeq}:${second(u)}`,
      launchAttack: launch },
    install: (battle, t) => {
      t.deploymentSlotCost = 0;
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        t.mem.tecnoBorn = true;
        battle.addBuff(t, { key: 'tecno:born', flags: { disarm: true } });
        t.mem.regularFormVisual = { clip: 'Start', loop: false, speed: 1 };
        battle.addBuff(t, { key: 'tecno:heal-free', persist: true, flags: { healFree: true } });
        syncDancer(battle, u, t);
        const seq = t.deploySeq;
        battle.after(model(t).durations.Start, () => {
          if (!exists(t) || t.deploySeq !== seq) return;
          t.mem.tecnoBorn = false; battle.removeBuff(t, 'tecno:born'); syncDancer(battle, u, t); t.atkCd = 0;
        }, { owner: t });
      }, { owner: t });
      battle.on('beforeAttack', ({ attacker, targets }) => {
        if (attacker !== t || !targets[0]) return;
        const dx = targets[0].x - t.x, dy = targets[0].y - t.y;
        t.dir = Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? 'LEFT' : 'RIGHT' : dy < 0 ? 'DOWN' : 'UP';
        battle.refreshRange(t);
      }, { owner: t });
    },
  } });
}
function withdraw(b, u) {
  for (const t of dancers(b, u)) b.retreat(t, { reason: 'tecno:withdraw', permanent: true });
}
function relocate(b, u) {
  const count = dancers(b, u).length, seq = u.deploySeq, epoch = ++u.mem.tecnoRespawnEpoch;
  withdraw(b, u);
  const next = index => {
    if (index >= count || !exists(u) || u.deploySeq !== seq || u.mem.tecnoRespawnEpoch !== epoch) return;
    const tiles = b.grid.tiles.flatMap((_, k) => {
      const r = Math.floor(k / COLS), c = k % COLS;
      return legalTile(b, r, c) ? [{ r, c, distance: (r - u.tileR) ** 2 + (c - u.tileC) ** 2 }] : [];
    });
    const nearest = Math.min(...tiles.map(t => t.distance));
    const choices = tiles.filter(t => t.distance === nearest);
    if (choices.length) { const tile = b.rng.pick(choices); spawn(b, u, tile.r, tile.c); }
    // Native waitFirst=false then .1 stack triggers; each attempt consumes a
    // stack even without space. Compiled filter27/comparator remain bounded.
    if (index + 1 < count) b.after(.1, () => next(index + 1), { owner: u });
  };
  next(0);
}
export function customizeTecnoKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  u.mem.tecnoRespawnEpoch = 0; u.mem.tecnoDeathTiles = new Map();
  kit.trait = { install: null, attack: 'ranged', projectile: 'none', dmgType: 'arts', canHitFly: true,
    maxTargets: 1, maxTargetsByBlock: false, hits: 1, hitsFn: null, splashRadius: 0, chain: null,
    allInRange: false, rangeAoe: false, hitAllBlocked: false, retargetOnRelease: false,
    acquireTargets: ownerTargets, heal: { ignoreHealFree: (_, owner, t) => t.defId === TOKEN && t.ownerUnit === owner },
    attackVisual: () => second(u) ? 'Skill_2_Loop' : 'Attack',
    windup: () => model(u).hits[second(u) ? 'Skill_2_Loop' : 'Attack'][0] / speed(u),
    attackEpoch: () => `${u.deploySeq}:${second(u)}`, launchAttack: launch };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    ...(s.id.endsWith('_1') ? { mods: { atkPct: s.bb.atk } }
      : { mods: { aspd: s.bb.attack_speed }, targeting: { rangeGrid: s.rangeGrid } }),
    onStart: () => {
      for (const t of dancers(b, u)) syncDancer(b, u, t);
      if (second(u)) u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop' };
    },
    onEnd: () => {
      for (const t of dancers(b, u)) syncDancer(b, u, t);
      u.mem.regularFormVisual = null;
      if (s.id.endsWith('_2') && exists(u)) relocate(b, u);
    } };
}
export function installTecno({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.every(.5, () => { for (const t of dancers(b, u)) syncDancer(b, u, t); }, { owner: u });
  b.on('deploy', ({ unit }) => {
    if (unit === u) { u.mem.tecnoDeathTiles.clear(); ++u.mem.tecnoRespawnEpoch; }
  }, { owner: u });
  b.on('kill', ({ victim: e }) => {
    // Capture before removal releases blocking/stealth. Any source's eligible
    // ground kill counts; leaks/forced exits never enter this native listener.
    const eligible = exists(u) && !u.hidden && e.side === 'enemy' && !e.isFlying && !e.hidden
      && !e.s.flags.untargetable && !enemyStealthed(e) && bodyInKeys(e, u.rangeKeySet);
    u.mem.tecnoDeathTiles.set(e, eligible ? { r: Math.round(e.y), c: Math.round(e.x) } : null);
  }, { owner: u });
  b.on('death', ({ unit: e, reason }) => {
    if (e === u) { ++u.mem.tecnoRespawnEpoch; u.mem.tecnoDeathTiles.clear(); withdraw(b, u); return; }
    const tile = u.mem.tecnoDeathTiles.get(e); u.mem.tecnoDeathTiles.delete(e);
    if (reason !== 'killed' || !tile || !exists(u)) return;
    if (dancers(b, u).length >= cap(u)) { const t = healTarget(b, u); if (t) healDancer(b, u, t); return; }
    const seq = u.deploySeq;
    b.after(.1, () => {
      if (!exists(u) || u.deploySeq !== seq) return;
      if (dancers(b, u).length >= cap(u)) { const t = healTarget(b, u); if (t) healDancer(b, u, t); }
      else spawn(b, u, tile.r, tile.c);
    }, { owner: u });
  }, { owner: u });
}
