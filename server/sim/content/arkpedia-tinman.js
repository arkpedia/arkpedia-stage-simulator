// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs, cached damage, field buffs and controller limits are kept
// in data/arkpedia-tinman-prefabs.json. Unity field particles are not invented.
import evidence from '../../../data/arkpedia-tinman-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { COLS } from '../constants.js';
const ID = 'char_4151_tinman';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const speed = u => Math.min(1, u.base.bat / u.s.interval);
const ground = { attack: 'ranged', canHitFly: false, maxTargets: 1 };
function target(b, u) { return acquireTargets(b, u, ground)[0]; }
function destination(b, u) {
  const t = target(b, u);
  if (t) return { x: t.x, y: t.y };
  // Native S2's second branch uses tile filter29 and final random selection.
  // Its compiled comparator is unavailable: use a random stage tile in range.
  const cells = u.rangeKeys.filter(k => b.grid.tiles[k]);
  if (!cells.length) return null;
  const key = b.rng.pick(cells); return { x: key % COLS, y: Math.floor(key / COLS) };
}
function normal(b, u, p, t, info) {
  b.addProjectile({ from: u, target: t, source: u, speed: 5, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: a, x, y }) => {
      if (a && canTargetEnemy(u, a, p)) resolveHit(b, u, p, a, info, x, y);
    } });
}
function clearEntry(b, field, a) {
  b.removeBuff(a, `${field.key}:regen`); b.removeBuff(a, `${field.key}:talent`);
  field.entries.delete(a);
}
function makeField(b, u, s, point, atk, scale) {
  const state = b._tinmanFields ??= { seq: 0 };
  const second = s.id.endsWith('_2'), field = { key: `tinman:field:${++state.seq}`,
    age: 0, duration: s.bb.projectile_delay_time, radius: s.bb.projectile_range,
    entries: new Map(), point, atk, scale };
  (u.mem.tinmanFields ??= []).push(field);
  b.fx('zone', { ...point, radius: field.radius, dur: field.duration, id: u.id, skill: 'tinman' });
  const sync = dt => {
    const remaining = field.duration - field.age;
    const elapsed = Math.min(dt, Math.max(0, remaining)); field.age += elapsed;
    const enemies = b.foesInRadius(point.x, point.y, field.radius).filter(a => !a.isFlying && a.deployed);
    const allies = second ? b.alliesInRadius(point.x, point.y, field.radius)
      .filter(a => !a.s.flags.untargetable && b.allySelectable(a, u)) : [];
    const present = new Set([...enemies, ...allies]);
    for (const a of field.entries.keys()) if (!present.has(a)) clearEntry(b, field, a);
    for (const a of present) {
      let entry = field.entries.get(a); const newlyAttached = !entry;
      if (!entry) {
        entry = { age: 0, next: .9, seq: a.deploySeq }; field.entries.set(a, entry);
        if (a.side === 'ally') b.addBuff(a, { key: `${field.key}:regen`, source: u,
          mods: { hpRegen: atk * s.bb.hp_recovery_per_sec_ratio } });
        else if (scale > 1) b.addBuff(a, { key: `${field.key}:talent`, source: u, data: { tinmanScale: scale } });
      }
      if (a.deploySeq !== entry.seq) { clearEntry(b, field, a); continue; }
      if (a.side === 'ally') continue; // native HP_RECOVERY_PER_SEC, not a periodic heal cast
      if (!second) b.applyStatus(a, 'weaken', { source: u, value: -s.bb.atk, duration: b.dt + 1e-6 });
      if (!newlyAttached) entry.age += elapsed;
      while (entry.next <= entry.age + 1e-9 && a.alive) {
        b.dealDamage(u, a, { amount: atk * s.bb.atk_scale, type: 'arts', sourceless: true,
          canDodge: false, isSkill: true, tags: ['dot', 'tinman:field'], applyWay: 'none' });
        entry.next += 1;
      }
    }
  };
  sync(0);
  // Projectiles/fields outlive the thrower's death or retreat. This callback
  // deliberately has no owner; the field's original dwell clock removes it.
  b.every(b.dt, (_b, timer) => {
    sync(b.dt);
    if (field.age + 1e-9 >= field.duration) {
      for (const a of field.entries.keys()) clearEntry(b, field, a);
      const list = u.mem.tinmanFields; if (list?.includes(field)) list.splice(list.indexOf(field), 1);
      timer.cancel();
    }
  });
}
function throwUnit(b, u, s, point) {
  const atk = u.s.atk, scale = u.def.talents.find(t => t.bb['skill@damage_scale'])?.bb['skill@damage_scale'] ?? 1;
  b.addProjectile({ from: u, to: point, source: u, speed: 3, maxAge: 100,
    visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ x, y }) => makeField(b, u, s, { x, y }, atk, scale) });
}
function manualCast(b, u, s) {
  const seq = u.deploySeq, epoch = u.attackControlEpoch;
  u.mem.regularFormVisual = { clip: 'Skill_2', loop: false };
  const state = { released: false, seq, epoch }; u.mem.tinmanCast = state;
  b.after(model(u).hits.Skill_2[0] / speed(u), () => {
    if (!live(u) || !u.canAct || !u.skill.active || u.mem.tinmanCast !== state
      || u.deploySeq !== seq || u.attackControlEpoch !== epoch) return;
    const point = destination(b, u); if (point) { state.released = true; throwUnit(b, u, s, point); }
    else u.skill.addCharge(1);
  }, { owner: u });
}
export function customizeTinmanKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', projectile: 'none', dmgType: 'phys', canHitFly: true,
    maxTargets: 1, maxTargetsByBlock: false, hits: 1, hitsFn: null, heal: null, splashRadius: 0,
    allInRange: false, rangeAoe: false, chain: null, launchAttack: normal, attackVisual: 'Attack',
    windup: () => model(u).hits.Attack[0] / speed(u), interruptOnSkillChange: true };
  const s = def.skill;
  if (s.id.endsWith('_1')) kit.skill = { id: s.id, name: s.name, kind: 'instant',
    trigger: { rule: 'DEFAULT' }, canActivate: () => !!target(b, u), attack: {
      canHitFly: false, attackVisual: 'Skill', windup: () => model(u).hits.Skill[0] / speed(u),
      retargetOnRelease: true, launchAttack: (_b, _u, _p, a) => throwUnit(b, u, s, { x: a.x, y: a.y }),
      afterAttack: (_b, _u, targets) => { if (!targets.length) u.skill.addCharge(1); } } };
  else kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: model(u).durations.Skill_2 / speed(u),
    trigger: { rule: 'NEVER' }, flags: { disarm: true }, attack: { noAttack: true },
    canActivate: () => !u.mem.tinmanCast && !!(target(b, u) || u.rangeKeys.some(k => b.grid.tiles[k])),
    onStart: () => { u.skill.timeLeft = model(u).durations.Skill_2 / speed(u); manualCast(b, u, s); },
    onTick: () => { const c = u.mem.tinmanCast; if (c && (!u.canAct || u.attackControlEpoch !== c.epoch)) u.skill.end('interrupted'); },
    onEnd: () => { u.mem.tinmanCast = null; u.mem.regularFormVisual = null; } };
}
export function installTinman({ battle: b, def }) {
  if (def.charId !== ID || b._tinmanDamageHook) return;
  b._tinmanDamageHook = true;
  // Original talent matches BUFF damage irrespective of its source. All fields
  // share one highest modifier; ordinary attacks and instant bursts bypass it.
  b.on('hit', ({ target: a, dmg }) => {
    if (a?.side !== 'enemy' || !(dmg.tags?.includes('dot'))) return;
    const scale = Math.max(1, ...a.buffs.map(v => v.data?.tinmanScale ?? 1));
    dmg.amount *= scale;
  });
}
