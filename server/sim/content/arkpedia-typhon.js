// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-typhon-prefabs.json' with { type: 'json' };
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInRadius } from '../body.js';

const ID = 'char_2012_typhon';
const live = u => u?.alive && u.deployed && !u.hidden;
const third = u => u.skill.active && u.skill.id === 'skchr_typhon_3';
const second = u => u.skill.active && u.skill.id === 'skchr_typhon_2';
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const plain = { attack: 'ranged', dmgType: 'phys', canHitFly: true, projectile: 'none' };
const key = (u, name) => `typhon:${name}:${u.id}`;
const component = (group, name, field) => evidence[group][name].flatMap(g => g.components)
  .map(c => c.data).find(c => c[field] != null);
const aimAbility = evidence.characters[ID].flatMap(g => g.components).map(c => c.data)
  .find(c => c._metadata?.namedAsAlias === 'Aim');
const aimTick = component('projectiles', 'projectile_chr_typhon_s3_aim', '_interval')._interval;
const radius = component('projectiles', 'projectile_chr_typhon_s3_aim', 'm_Radius').m_Radius;
const rain = component('projectiles', 'projectile_chr_typhon_s3', '_maxHitNum');
const rainTick = component('projectiles', 'projectile_chr_typhon_s3', '_interval')._interval;
const damageDelay = evidence.characters[ID].flatMap(g => g.components).map(c => c.data)
  .find(c => c._animKey === 'Skill_3_Loop')._activeBuffs[0].lifeTime;
const firstTalent = u => u.def.talents.find(t => t.bb.def_penetrate != null)?.bb;
const secondTalent = u => u.def.talents.find(t => t.bb.sluggish != null)?.bb;

function ordinaryTargets(b, u, p = plain) {
  const list = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!list.includes(e)) list.push(e);
  return sortEnemyTargets(b, u, list, 'heaviest');
}
function marked(e, u = null) {
  return e.buffs.some(v => v.key.startsWith('typhon:mark:') && (!u || v.key === key(u, 'mark')));
}
function targets(b, u, p) {
  if (!third(u)) {
    const result = ordinaryTargets(b, u, p).slice(0, 1);
    if (!result.length) u.mem.typhonOpening = true;
    return result;
  }
  const list = b.enemies.filter(e => canTargetEnemy(u, e, p) && marked(e, u));
  return sortEnemyTargets(b, u, list, 'heaviest').slice(0, 1);
}
function attackClip(u) {
  if (third(u)) return 'Skill_3_Loop';
  const down = u.dir === 'DOWN' && model(u).hits.Attack_Down_Loop;
  if (second(u)) return `Skill_${down ? 'Down_' : ''}2_${u.mem.typhonS2Uses > 1 ? 2 : 1}_Loop`;
  return down ? 'Attack_Down_Loop' : 'Attack_Loop';
}
function playback(u) {
  const n = u.s.aspd / 100;
  return second(u) && u.mem.typhonS2Uses === 1 ? n : Math.min(1, n);
}
function opening(u) {
  if (third(u) || second(u) && u.mem.typhonS2Uses > 1 || !u.mem.typhonOpening) return null;
  return attackClip(u).replace('_Loop', '_Begin');
}
function hit(b, u, e, { scale = 1, tag = 'typhon:arrow', info = {}, stun = 0, s2 = false } = {}) {
  const retained = tag === 'typhon:rain';
  // Rain has already attached a non-missable target buff. Its finish action
  // uses that recipient directly, rather than running a second selector.
  if (retained ? !e?.alive || !e.deployed : !canTargetEnemy(u, e, plain)) return;
  // Native active buffs are dispatched before ordinary arrow damage. The S3
  // target-owned delayed buff instead damages, then attaches its stun.
  if (s2 && b.rng() < u.def.skill.bb['attack@prob'])
    b.applyStatus(e, 'stun', { source: u, duration: u.def.skill.bb['attack@stun'] });
  b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale, type: 'phys',
    applyWay: tag === 'typhon:rain' ? 'none' : 'ranged', isAttack: true,
    isSkill: retained || info.isSkill, ignoreSelect: retained, attackId: info.attackId, tags: [tag] });
  if (stun > 0 && e.alive && e.deployed) b.applyStatus(e, 'stun', { source: u, duration: stun, ignoreSelect: retained });
}
function arrow(b, u, e, info, s2 = false) {
  b.addProjectile({ from: u, target: e, source: u, speed: s2 ? 10 : 12,
    maxAge: 10, visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target }) => { if (target) hit(b, u, target, { info, s2 }); } });
}
function volley(b, u, info) {
  const seq = u.deploySeq, bb = u.def.skill.bb;
  const count = bb['attack@s3_max_hit_num'];
  let spent = 0;
  // The original projectile has no range collider: its random selector reads
  // the Aim flags. Flags from other sources are accepted by this selector.
  // Stop selecting when its source is invalid; emitted target buffs retain
  // their .23-second lifetime even when the skill ends or source retires.
  const select = () => {
    if (!live(u) || u.deploySeq !== seq || spent >= count) return;
    const list = b.enemies.filter(e => canTargetEnemy(u, e, plain) && marked(e));
    if (!list.length) return;
    const e = list[Math.floor(b.rng() * list.length)]; spent++;
    b.after(damageDelay, () => hit(b, u, e, { scale: bb['attack@s3_atk_scale'],
      tag: 'typhon:rain', info, stun: bb['attack@s3_stun'] }));
  };
  select();
  for (let i = 1; i * rainTick < rain._lifeTime; i++) b.after(i * rainTick, select);
}
function launch(b, u, p, target, info) {
  u.mem.typhonOpening = false;
  if (third(u)) { volley(b, u, info); return; }
  if (!canTargetEnemy(u, target, p)) return;
  const s2 = second(u);
  if (s2) b.addBuff(target, { key: 'typhon:first-shot', source: u, duration: .10000000149011612 });
  arrow(b, u, target, info, s2);
  if (!s2) return;
  // Native S2SecondShot is triggered at cast, with a secondary preference for
  // recipients without the short first-shot flag. A sole recipient gets both.
  const list = ordinaryTargets(b, u, p);
  const next = list.find(e => !e.buffs.some(v => v.key === 'typhon:first-shot')) ?? list[0];
  if (next) arrow(b, u, next, info, true);
}
function clearMark(b, u) {
  u.mem.typhonMark = null;
  for (const e of b.enemies) b.removeBuff(e, key(u, 'mark'));
}
function clearFirstHits(b, u) {
  u.mem.typhonFirstVictims = null;
  for (const e of b.enemies) b.removeBuff(e, key(u, 'first-slow'));
}
function pollMark(b, u, state) {
  if (live(state.target) && state.target.deploySeq === state.targetSeq) {
    state.x = state.target.x; state.y = state.target.y;
  }
  state.clock += b.dt;
  if (state.clock + 1e-9 < aimTick) return;
  state.clock -= aimTick;
  for (const e of b.enemies) if (canTargetEnemy(u, e, plain) && bodyInRadius(e, state.x, state.y, radius))
    b.addBuff(e, { key: key(u, 'mark'), source: u, duration: aimAbility._activeBuffs[0].lifeTime });
}
function form(b, u, clip, duration, next = null) {
  const token = {}, seq = u.deploySeq;
  u.mem.typhonForm = token; u.mem.regularFormVisual = { clip, loop: false };
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.mem.typhonForm === token)
      u.mem.regularFormVisual = next ? { clip: next, loop: true } : null;
  }, { owner: u });
}
function end(b, u, reason) {
  clearMark(b, u); clearFirstHits(b, u); u.mem.typhonOpening = true;
  u.mem.typhonBlockedUntil = b.time;
  if (!live(u) || ['death', 'retreat'].includes(reason)) {
    u.mem.typhonForm = null; u.mem.regularFormVisual = null; return;
  }
  if (u.skill.id === 'skchr_typhon_3') form(b, u, 'Skill_3_End', model(u).durations.Skill_3_End);
  else u.mem.regularFormVisual = null;
}
export function customizeTyphonKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...plain, hits: 1, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, splashRadius: 0,
    chain: null, hitsFn: null, dmgMul: null, heal: null, install: null,
    acquireTargets: targets, interruptOnSkillChange: true, retargetOnRelease: false,
    attackVisual: (_b, a) => opening(a) ? { begin: opening(a), loop: attackClip(a),
      beginDuration: model(a).durations[opening(a)] / playback(a) } : attackClip(a),
    windup: (_b, a) => (model(a).hits[attackClip(a)][0]
      + (opening(a) ? model(a).durations[opening(a)] : 0)) / playback(a),
    canAttack: () => b.time + 1e-9 >= (u.mem.typhonBlockedUntil ?? 0), launchAttack: launch };
  const s = def.skill, bb = s.bb;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk ?? 0, aspd: bb.attack_speed ?? 0 },
    onStart: () => { u.mem.typhonFirstVictims = new Set(); }, onEnd: ({ reason }) => end(b, u, reason) };
  if (s.id === 'skchr_typhon_2') kit.skill.onStart = () => {
    u.mem.typhonFirstVictims = new Set();
    u.mem.typhonOpening = true;
    u.mem.typhonS2Uses = (u.mem.typhonS2Uses ?? 0) + 1;
    if (u.mem.typhonS2Uses > 1) {
      u.skill.timeLeft = Infinity;
      const clip = u.dir === 'DOWN' ? 'Skill_Down_2_2_Begin' : 'Skill_2_2_Begin';
      u.mem.typhonBlockedUntil = b.time + model(u).durations[clip];
      form(b, u, clip, model(u).durations[clip], u.dir === 'DOWN' ? 'Skill_Down_2_2_Idle' : 'Skill_2_2_Idle');
    }
  };
  if (s.id === 'skchr_typhon_3') kit.skill = {
    ...kit.skill, kind: 'ammo', ammo: bb['attack@s3_trigger_time'], manualCancel: true,
    mods: { batFlat: bb.base_attack_time },
    canActivate: () => ordinaryTargets(b, u).length > 0,
    onStart: () => {
      u.mem.typhonFirstVictims = new Set();
      const target = ordinaryTargets(b, u)[0];
      const state = { target, targetSeq: target.deploySeq, x: target.x, y: target.y, clock: aimTick };
      u.mem.typhonMark = state; pollMark(b, u, state);
      // Aim is a fixed-time ability: original 1.05-second Disarmed holder.
      u.mem.typhonBlockedUntil = b.time + 1.0499999523162842;
      form(b, u, 'Skill_3_Begin', model(u).durations.Skill_3_Begin, 'Skill_3_Idle');
    },
    onTick: () => { if (u.mem.typhonMark) pollMark(b, u, u.mem.typhonMark); },
    onAttack: ctx => {
      ctx.noAmmo = true;
      const sk = u.skill; sk.ammoLeft--; b.emit('ammoUsed', { unit: u, left: sk.ammoLeft, skill: sk });
      if (sk.ammoLeft > 0) return;
      const seq = u.deploySeq, activation = sk.activations;
      u.mem.typhonBlockedUntil = Infinity;
      // Native count finishes on attack completion. This adapter reserves the
      // projectile's .7s selection lifetime and final target-buff delay; the
      // compiled continuous-attack/end dispatcher still needs frame comparison.
      b.after(rain._lifeTime + damageDelay, () => {
        if (live(u) && u.deploySeq === seq && sk.activations === activation && sk.active) sk.end('ammo');
      }, { owner: u });
    },
  };
}
export function installTyphon({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.typhonS2Uses = 0; u.mem.typhonStacks = 0; u.mem.typhonStackUntil = -Infinity;
    u.mem.typhonOpening = true;
    u.mem.typhonFirstVictims = null; u.mem.typhonMark = null;
    u.mem.typhonBlockedUntil = b.time + model(u).durations.Start;
  }, { owner: u });
  b.on('hit', ({ source, target, dmg }) => {
    if (source !== u || target.side !== 'enemy' || !dmg.tags.some(t => t.startsWith('typhon:'))) return;
    const t1 = firstTalent(u), t2 = secondTalent(u);
    if (t1) {
      if (b.time + 1e-9 >= u.mem.typhonStackUntil) u.mem.typhonStacks = 0;
      u.mem.typhonStacks = Math.min(t1.max_stack_cnt, u.mem.typhonStacks + 1);
      u.mem.typhonStackUntil = b.time + t1.duration;
      dmg.defIgnorePct += u.mem.typhonStacks * t1.def_penetrate;
    }
    if (u.skill.active && t2 && u.mem.typhonFirstVictims && !u.mem.typhonFirstVictims.has(target)) {
      u.mem.typhonFirstVictims.add(target); dmg.amount *= t2.atk_scale;
      b.applyStatus(target, 'sluggish', { key: key(u, 'first-slow'), source: u, duration: t2.sluggish });
    }
  }, { owner: u });
  for (const event of ['retreat', 'death']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    clearMark(b, u); clearFirstHits(b, u); u.mem.typhonForm = null; u.mem.regularFormVisual = null;
  }, { owner: u });
}
