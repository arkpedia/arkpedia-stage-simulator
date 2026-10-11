// SPDX-License-Identifier: GPL-3.0-or-later
// Recovered components, selectors, projectiles and exact facing bindings live in
// data/arkpedia-gladiia-prefabs.json. Native FSM/shift physics/particles are not certified.
import evidence from '../../../data/arkpedia-gladiia-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_474_glady';
const live = u => u?.alive && u.deployed && !u.hidden;
const m = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const form = (u, clip, loop = false) => { u.mem.regularFormVisual = clip ? { clip, loop } : null; };
const plain = { attack: 'ranged', dmgType: 'phys', applyWay: 'ranged', projectile: 'none',
  canHitFly: true, maxTargets: 1, hits: 1, allInRange: false, hitAllBlocked: false, splashRadius: 0 };
const number = u => Number(u.skill.id.at(-1));
function targets(b, u, p) {
  const es = b.enemiesInKeys(u.rangeKeys, u, p);
  sortEnemyTargets(b, u, es, p.priority);
  if (u.skill.active && number(u) === 2) es.sort((a, z) => Number(!a.blockedBy) - Number(!z.blockedBy));
  return es.slice(0, p.maxTargets ?? 1);
}
function abort(b, u) {
  const cast = u.mem.gladiiaCast; if (!cast) return;
  u.mem.gladiiaCast = null; cast.watch?.cancel();
  for (const j of cast.jobs) j.cancel();
  b.removeProjectiles(p => p.data?.gladiiaCast === cast);
  for (const e of b.enemies) { b.removeBuff(e, cast.bind); b.removeBuff(e, cast.slow); }
  b.removeBuff(u, 'gladiia:cast'); form(u, null);
  if (number(u) === 3 && u.skill.active) u.skill.end('interrupted');
}
function newCast(b, u, n, attackId) {
  if (u.mem.gladiiaCast?.attackId === attackId) return u.mem.gladiiaCast;
  const cast = { n, attackId, seq: u.deploySeq, jobs: [], pending: 0, finishing: false,
    bind: `gladiia:bind:${u.id}:${attackId}`, slow: `gladiia:slow:${u.id}:${attackId}` };
  u.mem.gladiiaCast = cast;
  b.addBuff(u, { key: 'gladiia:cast', flags: { disarm: true, noSp: true } });
  cast.epoch = u.attackControlEpoch;
  cast.watch = b.every(b.dt, () => {
    if (!live(u) || u.deploySeq !== cast.seq || u.attackControlEpoch !== cast.epoch) abort(b, u);
  }, { owner: u });
  return cast;
}
function after(b, u, cast, delay, fn) {
  const job = b.after(delay, () => { if (live(u) && u.mem.gladiiaCast === cast) fn(); }, { owner: u });
  cast.jobs.push(job); return job;
}
function finish(b, u, cast) {
  if (cast.finishing || u.mem.gladiiaCast !== cast) return;
  cast.finishing = true;
  const clip = `Skill_${cast.n}_End`;
  form(u, clip);
  after(b, u, cast, Math.max(1, m(u).durations[clip] / rate(u)), () => {
    cast.watch?.cancel(); u.mem.gladiiaCast = null;
    b.removeBuff(u, 'gladiia:cast'); form(u, null);
    if (cast.n === 3 && u.skill.active) u.skill.end('hook-finished');
    if (cast.refund) u.skill.setSpTotal(u.skill.spTotal + cast.refund);
  });
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const n = info.isSkill ? number(u) : 0;
  const cast = n ? newCast(b, u, n, info.attackId) : null;
  if (cast) { cast.pending++; form(u, `Skill_${n}_Loop`, true); }
  const projectile = b.addProjectile({ from: u, source: u, target: e, speed: 10,
    maxAge: n ? 5 : 10, visual: 'orb', data: { arkpediaTrackedVisual: true, gladiiaCast: cast },
    onHit: ({ target }) => {
      if (cast && (u.mem.gladiiaCast !== cast || cast.finishing)) return;
      if (target && canTargetEnemy(u, target, p)) {
        resolveHit(b, u, p, target, info, target.x, target.y);
        if (cast && live(target)) b.pullToFront(target, u,
          n === 1 ? u.skill.bb.force : u.skill.bb['attack@force']);
      }
      if (cast) after(b, u, cast, 1, () => { if (--cast.pending === 0) finish(b, u, cast); });
    } });
  // A dead/hidden INPUT victim may remove a projectile without its onHit.
  if (cast) after(b, u, cast, 5.1, () => {
    if (!cast.finishing && !b.projectiles.list.some(p => p.data?.gladiiaCast === cast)) finish(b, u, cast);
  });
  return projectile;
}
function whirlpool(b, u) {
  const p = { ...plain, priority: 'farthest' }, main = targets(b, u, p)[0];
  if (!main) { u.skill.end('no-target'); return; }
  const bb = u.skill.bb, cast = newCast(b, u, 3, `gladiia:${u.id}:${u.skill.activations}`);
  form(u, 'Skill_3_Startup');
  after(b, u, cast, m(u).hits.Skill_3_Startup[0], () => {
    // The immediate-reach source projectile uses followTarget=0. Retain this
    // world position even if the bound target dies or is shifted elsewhere.
    const center = { x: main.x, y: main.y }; cast.center = center;
    cast.fieldEndsAt = b.time + bb.hit_duration;
    if (live(main)) b.applyStatus(main, 'bind', { key: cast.bind, duration: bb.hit_duration, source: u });
    form(u, 'Skill_3_Chant', true);
    const eligible = radius => b.enemiesInRadius(center.x, center.y, radius)
      .filter(e => canTargetEnemy(u, e, plain));
    const pulse = () => {
      for (const e of eligible(1.5)) {
        b.addBuff(e, { key: cast.slow, source: u, duration: bb.interval,
          refresh: 'replace', mods: { movePct: bb.move_speed } });
        b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * bb.atk_scale,
          type: 'arts', isSkill: true, isAttack: true, isProjectile: true,
          applyWay: 'ranged', attackId: cast.attackId, tags: ['gladiia:whirlpool'] });
        if (live(e)) b.pull(e, bb.force, { to: center, center, stop: 0 });
      }
    };
    // The projectile does not wait for its first interval. Six source-interval
    // pulses occupy [0,9); the table's duration=8 is not the link lifetime.
    for (let t = 0; t < bb.hit_duration - 1e-9; t += bb.interval) {
      if (t === 0) pulse(); else after(b, u, cast, t, pulse);
    }
    after(b, u, cast, bb.projectile_delay_time, () => {
      b.removeBuff(main, cast.bind);
      const es = eligible(1); cast.finalTargets = es;
      form(u, 'Skill_3_Begin');
      after(b, u, cast, m(u).hits.Skill_3_Begin[0] / rate(u), () => {
        form(u, 'Skill_3_Loop', true);
        // Recovered final projectile: .3s first pull, .5-tile source offset,
        // then 1s second pull. It is a zero-damage hook, not another Arts pulse.
        for (const e of es) if (live(e)) b.pull(e, bb['attack@force'], { to: center, center, stop: 0 });
        after(b, u, cast, .3, () => {
          for (const e of es) if (live(e)) b.pullToFront(e, u, bb['attack@force']);
          after(b, u, cast, 1, () => finish(b, u, cast));
        });
      });
    });
  });
}
export function customizeGladiiaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  const s = def.skill, n = Number(s.id.at(-1)), bb = s.bb;
  kit.trait = { ...plain, acquireTargets: targets, launchAttack: launch, attackVisual: 'Attack',
    windup: () => m(u).hits.Attack[0] * 100 / u.s.aspd,
    interruptOnSkillChange: true, retargetOnRelease: false,
    canAttack: () => !u.mem.gladiiaCast };
  if (n === 3) {
    kit.skill = { id: s.id, name: s.name, kind: 'toggle', duration: bb.hit_duration,
      durationRemaining: () => u.mem.gladiiaCast?.fieldEndsAt == null ? bb.hit_duration
        : Math.max(0, u.mem.gladiiaCast.fieldEndsAt - b.time),
      canActivate: () => !u.mem.gladiiaCast && targets(b, u, plain).length > 0,
      onStart: () => whirlpool(b, u), onEnd: () => abort(b, u) };
    return;
  }
  kit.skill = { id: s.id, name: s.name, kind: n === 1 ? 'charges' : 'duration',
    charges: s.maxChargeTime, duration: s.duration,
    canActivate: () => !u.mem.gladiiaCast,
    ...(n === 2 ? { mods: { batFlat: bb.base_attack_time }, targeting: { rangeGrid: s.rangeGrid } } : {}),
    attack: { atkScale: n === 1 ? bb.atk_scale : bb['attack@atk_scale'],
      priority: n === 1 ? 'farthest' : null, maxTargets: n === 1 ? 1 : bb['attack@max_target'],
      windup: () => m(u).hits[`Skill_${n}_Begin`][0] / rate(u),
      attackVisual: `Skill_${n}_Begin`,
      afterAttack: (_b, _u, es, info) => {
        if (u.mem.gladiiaCast?.attackId === info.attackId) return;
        const cast = newCast(b, u, n, info.attackId);
        if (n === 1 && info.inputTargets.every(e => !live(e))) cast.refund = u.skill.spCost;
        finish(b, u, cast);
      } },
    onStart: () => {
      if (n === 1) b.addBuff(u, { key: 'gladiia:windup', flags: { noSp: true }, duration: m(u).durations.Skill_1_Begin / rate(u) });
      else {
        form(u, 'Skill_2_Startup');
        b.addBuff(u, { key: 'gladiia:startup', duration: m(u).durations.Skill_2_Startup, flags: { disarm: true } });
        b.after(m(u).durations.Skill_2_Startup, () => { if (live(u) && u.skill.active) { form(u, null); u.atkCd = 0; } }, { owner: u });
      }
    },
    onEnd: ({ reason }) => { if (!['instant','hook-finished'].includes(reason)) abort(b, u); } };
}
export function installGladiia({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const waves = def.talents.find(t => t.bb.damage_resistance != null)?.bb;
  const sync = () => {
    for (const a of b.allyUnits) {
      const key = `gladiia:recovery:${u.id}`;
      if (waves && live(u) && live(a) && a.tags.has('abyssal')) {
        if (!a.findBuff(key)) b.addBuff(a, { key, source: u,
          mods: { hpRegenRatio: waves.hp_recovery_per_sec_by_max_hp_ratio } });
      } else b.removeBuff(a, key);
    }
  };
  if (waves) {
    sync(); for (const ev of ['deploy','death','tick']) b.on(ev, sync, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (live(u) && live(target) && target.side === 'ally' && target.tags.has('abyssal')
        && source?.tags.has('seamonster') && ['phys','arts'].includes(dmg.type)) dmg.mul *= 1 - waves.damage_resistance;
    }, { owner: u });
  }
  const fittest = def.talents.find(t => t.bb.value != null)?.bb;
  if (fittest) b.on('hit', ({ source, target, dmg }) => {
    if (source === u && target.side === 'enemy' && target.s.massLevel <= fittest.value)
      dmg.amount *= fittest.atk_scale;
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) { abort(b, u); sync(); } }, { owner: u });
}
