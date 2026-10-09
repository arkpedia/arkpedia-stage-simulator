// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and bounded mover/FSM mapping: arkpedia-brigid-prefabs.json.
import evidence from '../../../data/arkpedia-brigid-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { resolveHit } from '../ai.js';
const ID = 'char_4177_brigid';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const clip = (u, name, down) => u.dir === 'DOWN' ? down : name;
const plain = p => ({ ...p, launchAttack: null, hits: 1, hitsFn: null, chain: null,
  maxTargets: 1, allInRange: false, splashRadius: 0 });
function flight(b, u, p, input, info) {
  if (!input || !canTargetEnemy(u, input, p)) return;
  const state = { seq: u.deploySeq, born: b.time, ending: false };
  u.mem.brigidFlight = state;
  const home = () => live(u) && u.deploySeq === state.seq && u.mem.brigidFlight === state;
  const s1 = info.isSkill && u.skill.id === 'skchr_brigid_1';
  const s2 = info.isSkill && u.skill.id === 'skchr_brigid_2';
  const bb = { ...u.skill.bb }, limit = s1 ? 25 : 10;
  const remaining = () => Math.max(0, state.born + limit - b.time);
  const legal = e => !!e && canTargetEnemy(u, e, p);
  const hit = (e, profile = p) => {
    if (legal(e)) resolveHit(b, u, plain(profile), e, info, e.x, e.y);
  };
  const returnToHand = (from, delay = 0) => {
    if (state.ending) return;
    state.ending = true;
    b.after(delay, () => {
      // Born projectiles survive their source. A returning old projectile must
      // never release the fresh projectile belonging to a later deployment.
      b.addProjectile({ from, ...(home() ? { target: u } : { to: { x: u.x, y: u.y } }),
        source: u, speed: 3.75, maxAge: Math.max(b.dt, remaining()), hitDead: true,
        visual: 'boomerangReturn', data: { arkpediaTrackedVisual: true },
        onHit: () => { if (home()) u.mem.brigidFlight = null; } });
    });
  };
  let bounces = s1 ? bb.times : 0;
  const recentlyHit = new Map();
  const segment = (e, from, speed) => {
    if (remaining() <= 0) { returnToHand(from); return; }
    b.addProjectile({ from, target: e, source: u, speed, maxAge: remaining(),
      hitDead: true, visual: 'boomerang', data: { arkpediaTrackedVisual: true },
      onHit: ({ target, x, y }) => {
        const point = { x, y };
        if (s2 && legal(target)) {
          const seq = target.deploySeq;
          let done = false;
          const valid = () => target.deploySeq === seq && legal(target);
          // Local slow attachment precedes primary damage. Native DB-loaded
          // missability inheritance remains an explicit evidence limit.
          b.applyStatus(target, 'sluggish', { source: u, duration: bb['attack@sluggish'] });
          hit(target);
          const finish = () => {
            if (done) return;
            done = true; monitor.cancel();
            returnToHand({ x: target.x, y: target.y });
          };
          const monitor = b.every(b.dt, () => { if (!valid()) finish(); });
          const interval = bb['attack@interval'];
          const count = Math.round(bb['attack@cut_duration'] / interval);
          for (let i = 1; i <= count; i++) b.after(i * interval, () => {
            if (done) return;
            if (!valid()) { finish(); return; }
            hit(target, { ...p, atkScale: bb['attack@cut_scale'] });
          });
          // Register after cuts so the boundary cut is processed before return.
          b.after(bb['attack@projectile_delay_time'], finish);
          return;
        }
        if (legal(target)) { hit(target); recentlyHit.set(target, b.time); }
        if (!s1 || bounces <= 0 || remaining() <= 0) {
          returnToHand(point, .009999999776482582); return;
        }
        // Native radius1.7, .7s hit memory and allowRepetitionIfNoTarget1.
        // Prefer fresh non-current victims; a repeat fallback resets hit memory.
        // Native selection/reset ordering is a documented web interpretation.
        const candidates = b.enemiesInRadius(x, y, 1.7000000476837158)
          .filter(a => a !== target && legal(a))
          .sort((a, z) => Math.hypot(a.x-x,a.y-y) - Math.hypot(z.x-x,z.y-y) || a.id-z.id);
        let next = candidates.find(a => !recentlyHit.has(a)
          || b.time - recentlyHit.get(a) >= .699999988079071);
        if (!next && candidates.length) { recentlyHit.clear(); next = candidates[0]; }
        if (!next) { returnToHand(point, .009999999776482582); return; }
        bounces--;
        segment(next, point, 6);
      } });
  };
  segment(input, u, 15);
}
export function customizeBrigidKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', dmgType: 'phys', applyWay: 'ranged',
    projectile: 'none', groundOnly: false, canHitFly: true, priority: null,
    hits: 1, hitsFn: null, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, splashRadius: 0,
    chain: null, dmgMul: null, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.brigidFlight,
    windup: () => model(u).hits.Attack[0] / rate(u),
    attackVisual: () => clip(u, 'Attack', 'Attack_Down'),
    launchAttack: flight };
  const s = def.skill, bb = s.bb;
  kit.skill = { id: s.id, name: s.name,
    canActivate: () => live(u) && u.canAct && !u.s.flags.silence };
  if (s.id === 'skchr_brigid_1') Object.assign(kit.skill, {
    kind: 'instant', attack: { atkScale: bb.atk_scale,
      windup: () => model(u).hits.Skill_1[0] / rate(u),
      attackVisual: () => clip(u, 'Skill_1', 'Skill_Down_1'),
      afterAttack: (_b, unit, _targets, meta) => {
        if (meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
      } } });
  else Object.assign(kit.skill, { kind: 'duration', duration: s.duration,
    trigger: 'NEVER', mods: { atkPct: bb.atk },
    onStart: () => { u.mem.regularFormVisual = { clip: clip(u, 'Skill_2_Idle', 'Skill_Down_2_Idle'), loop: true }; },
    onEnd: () => { u.mem.regularFormVisual = null; },
    attack: { atkScale: 1,
      windup: () => model(u).hits.Skill_2_Loop[0] / rate(u),
      attackVisual: () => clip(u, 'Skill_2_Loop', 'Skill_Down_2_Loop') } });
}
export function installBrigid({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const talent = def.talents[0]?.bb;
  b.on('outputDamage', ({ source, dmg }) => {
    if (source !== u || !live(u) || !talent || dmg.cancel || u.mem.brigidDodge) return;
    u.mem.brigidCount = (u.mem.brigidCount ?? 0) + 1;
    if (u.mem.brigidCount === talent.trigger_damage_count) {
      u.mem.brigidDodge = true;
      b.addBuff(u, { key: `brigid:dodge:${u.id}`, mods: { dodgePhys: talent.prob } });
    }
  }, { owner: u });
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.brigidCount = 0; u.mem.brigidDodge = false; u.mem.brigidFlight = null;
  }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    u.mem.brigidFlight = null; u.mem.regularFormVisual = null;
    u.mem.brigidDodge = false; u.mem.brigidCount = 0;
  }, { owner: u });
}
