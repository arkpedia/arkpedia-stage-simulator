// SPDX-License-Identifier: GPL-3.0-or-later
import { ROSA_OPERATORS } from '../../../shared/arkpedia/rosa-operators.js';
import evidence from '../../../data/arkpedia-rosa-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const ID = 'char_197_poca';
const live = u => u?.alive && u.deployed && !u.hidden;
const exists = u => u?.alive && u.deployed;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
  dmgMul: null, applyWay: 'ranged' });

/** Exact native predeck selector has student tag and includes bench/support.
 * Store a named contribution separately so preparation is idempotent and the
 * ordinary additive percentage bucket composes with other producers. */
export function prepareRosaSquad(records) {
  const pct = Math.max(0, ...Object.values(records).filter(r => r.charId === ID)
    .flatMap(r => r.talents.filter(t => t.prefabKey === '2').map(t => t.bb.atk)));
  for (const r of Object.values(records)) {
    const old = r.arkpedia.rosaSquadAtkPct ?? 0;
    const next = r.tags.includes('student') ? pct : 0;
    if (old === next) continue;
    r.arkpedia.modifiers.atkPct = (r.arkpedia.modifiers.atkPct ?? 0) + next - old;
    r.arkpedia.rosaSquadAtkPct = next;
  }
}

function hit(b, u, e, p, info) {
  const t = u.def.talents.find(t => t.bb.def_penetrate != null)?.bb;
  const handle = t && b.on('hit', ctx => {
    if (ctx.source === u && ctx.target === e && ctx.dmg.attackId === info.attackId
      && e.weight >= t.value) ctx.dmg.defIgnorePct += t.def_penetrate;
  });
  try { resolveHit(b, u, plain(p), e, info, e.x, e.y); }
  finally { if (handle) b.off(handle); }
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  return b.addProjectile({ from: u, target, source: u, speed: 15, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e }) => {
      if (e && canTargetEnemy(u, e, p)) hit(b, u, e, p, info);
    } });
}
function harpoonTargets(b, u) {
  const p = { ...u.profile, canHitFly: true, maxTargets: u.def.skill.bb.max_target };
  const targets = b.enemies.filter(e => canTargetEnemy(u, e, p) && bodyInKeys(e, u.rangeKeySet));
  sortEnemyTargets(b, u, targets, 'heaviest');
  return targets.slice(0, p.maxTargets + Math.max(0, Math.floor(u.s.maxTargets)));
}
function harpoons(b, u) {
  const seq = u.deploySeq, act = u.skill.activations, s = u.def.skill, bb = s.bb;
  const key = `rosa:cast:${u.id}`, pending = { cancelled: false, released: false,
    links: [], endAt: Infinity, ending: false };
  u.mem.rosaHarpoons = pending;
  b.addBuff(u, { key, flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.skill.active
    && u.skill.activations === act && !pending.cancelled;
  const unborn = () => valid() && u.canAct && u.attackControlEpoch === epoch;
  const visual = clip => { if (valid()) u.mem.regularFormVisual = { clip, loop: clip === 'Skill_Loop' }; };
  visual('Skill_Begin');
  const finish = () => {
    if (pending.ending) return;
    pending.ending = true;
    const duration = model(u).durations.Skill_End;
    pending.endAt = b.time + duration;
    visual('Skill_End');
    b.after(duration, () => {
      if (valid()) u.skill.end('projectiles-finished');
    }, { owner: u });
  };
  let deathHandle = null;
  const detach = link => {
    if (link.done) return;
    link.done = true;
    if (link.timer) link.timer.cancel();
    b.removeBuff(link.target, link.key);
    if (pending.links.every(x => x.done)) {
      if (deathHandle) { b.off(deathHandle); deathHandle = null; }
      if (valid()) finish();
    }
  };
  pending.stopUnborn = () => {
    if (pending.released) return;
    pending.cancelled = true;
    if (u.deploySeq === seq && u.skill.activations === act && u.skill.active)
      u.skill.end('interrupt');
  };
  const watch = b.every(b.dt, () => {
    if (!pending.released) { if (!unborn()) { pending.stopUnborn(); watch.cancel(); } return; }
    // Emitted links have their own native unmanaged lifetime. They are not
    // cancelled by owner retirement/control; the still-live skill waits for
    // every original link and then its original .933s end animation.
    for (const link of pending.links) {
      if (link.done) continue;
      if (!exists(link.target) || link.target.deploySeq !== link.targetSeq) detach(link);
      else if (!link.started && !b.projectiles.list.includes(link.projectile)) detach(link);
    }
    if (pending.links.every(link => link.done)) {
      if (!valid()) { watch.cancel(); return; }
      finish();
    }
    if (!valid()) return;
    u.skill.timeLeft = Number.isFinite(pending.endAt) ? Math.max(0, pending.endAt - b.time)
      : Math.max(0, ...pending.links.map(link => link.until == null ? bb.hit_duration : link.until - b.time));
    if (pending.ending && b.time + 1e-9 >= pending.endAt) watch.cancel();
  });
  const preDelay = evidence.runtimeMapping.s3PreDelay;
  b.after(preDelay, () => {
    if (!unborn()) { pending.stopUnborn(); return; }
    pending.released = true;
    visual('Skill_Loop');
    const targets = harpoonTargets(b, u), attackId = ++b._attackSeq;
    for (const e of targets) {
      const link = { target: e, targetSeq: e.deploySeq, done: false, started: false,
        key: `rosa:harpoon:${u.id}:${act}:${e.id}` };
      pending.links.push(link);
      link.projectile = b.addProjectile({ from: u, target: e, source: u, speed: 10,
        visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target: victim }) => {
          if (!victim || !exists(victim) || victim.deploySeq !== link.targetSeq) { detach(link); return; }
          link.started = true; link.until = b.time + bb.hit_duration;
          const pulse = () => {
            if (link.done || !exists(victim) || victim.deploySeq !== link.targetSeq) { detach(link); return; }
            if (b.time + 1e-9 >= link.until) { detach(link); return; }
            if (!canTargetEnemy(u, victim, { canHitFly: true })) return;
            // Infinity active bind is attached by the native link and detached
            // when that link stops. Keep source ownership separate from other
            // producers; temporary disappearance does not replace the victim.
            b.applyStatus(victim, 'bind', { key: link.key, source: u, duration: Infinity });
            hit(b, u, victim, { ...u.profile, atkScale: 1 }, { isSkill: true, attackId });
          };
          pulse();
          if (!link.done) link.timer = b.every(bb.hit_interval, pulse);
          b.after(bb.hit_duration, () => { detach(link); if (valid() && pending.links.every(x => x.done)) finish(); });
        } });
    }
    if (!targets.length) finish();
    else deathHandle = b.on('death', ({ unit }) => {
      for (const link of pending.links) if (unit === link.target) detach(link);
    });
  }, { owner: u });
}

export function customizeRosaKit({ battle: b, id, def, unit: u, kit }) {
  if (!ROSA_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', canHitFly: true, priority: 'heaviest',
    projectile: 'none', maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, splashRadius: 0, hits: 1, hitsFn: null, chain: null,
    dmgMul: null, install: null, interruptOnSkillChange: true, retargetOnRelease: true,
    windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit),
    attackVisual: 'Attack', launchAttack: launch };
  const s = def.skill, bb = s.bb, third = s.id === 'skchr_poca_3';
  kit.skill = { id: s.id, name: s.name, kind: third ? 'toggle' : 'duration',
    duration: s.duration, mods: { atkPct: bb.atk },
    ...(third ? { attack: { noAttack: true }, onStart: () => harpoons(b, u),
      onEnd: () => {
        b.removeBuff(u, `rosa:cast:${u.id}`); u.mem.regularFormVisual = null;
        const state = u.mem.rosaHarpoons;
        if (state && !state.released) state.cancelled = true;
      } } : s.id === 'skchr_poca_2' ? { attack: { maxTargets: bb['attack@max_target'] } } : {}) };
}
export function installRosa({ battle: b, unit: u, def }) {
  if (!ROSA_OPERATORS[def.charId]) return;
}
