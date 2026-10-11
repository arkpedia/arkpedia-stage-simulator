// SPDX-License-Identifier: GPL-3.0-or-later
// Native graph and literal animation events: data/arkpedia-pepe-prefabs.json.
// Modules and native Unity effects are not enabled.
import evidence from '../../../data/arkpedia-pepe-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { lessingResistableBuff } from './arkpedia-lessing.js';
import { isHpLoss } from '../damage.js';
const ID = 'char_4058_pepe';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
// Native timeMode0 follows the attack interval, including BAT additions.
const attackRate = u => u.base.bat / u.s.interval;
const mode = u => u.skill?.active && !u.mem.pepeTransition ? Number(u.skill.id.at(-1)) : 0;
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys', applyWay: 'melee',
  canHitFly: false, hits: 1, maxTargets: 1, splashRadius: 0, chain: null, dmgMul: null };
const resistable = f => lessingResistableBuff(f);
const abnormal = u => u.buffs.some(resistable);
const radius = u => 1 + (mode(u) === 3 ? (u.mem.pepeStacks ?? 0) * u.skill.bb['attack@ability_range_forward_extend'] : 0);
function clip(u) {
  const n = mode(u);
  return n === 1 && u.skill.pending ? 'Skill_1' : n === 2 ? 'Skill_2_Loop'
    : n === 3 ? 'Skill_3_Loop_' + ((u.mem.pepeStacks ?? 0) >= u.skill.bb['attack@max_stack_cnt'] ? 'B' : 'A') : 'Attack';
}
function choose(b, u, p) {
  const input = u.mem.pepeInput;
  if (input && mode(u) === 1 && u.skill.pending)
    return canTargetEnemy(u, input, { ...p, canHitFly: input.blockedBy === u }) ? [input] : [];
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!targets.includes(e)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  if (mode(u) === 2 && targets.length) return [targets[Math.min(targets.length - 1, Math.floor(b.rng() * targets.length))]];
  return targets.slice(0, 1);
}
function refund(u) {
  const t = u.def.talents.find(t => t.bb.max_sp != null)?.bb;
  if (live(u) && t) u.skill.gainSp(Math.min(t.max_sp, (u.mem.pepeKills ?? 0) * t.sp), 'init');
  u.mem.pepeKills = 0;
}
function strike(b, u, e, scale, info) {
  const p = { ...plain, atkScale: scale, canHitFly: e.blockedBy === u };
  if (!canTargetEnemy(u, e, p)) return false;
  resolveHit(b, u, p, e, info, e.x, e.y); return true;
}
function launch(b, u, p, e, info) {
  const n = mode(u), at = { x: e.x, y: e.y }, r = radius(u);
  if (!strike(b, u, e, n === 1 && info.isSkill ? u.skill.bb.atk_scale : 1, info)) return;
  const mainDodged = u.mem.pepeDodgeAttack === info.attackId && u.mem.pepeDodgeTarget === e;
  u.mem.pepeFired = info.attackId;
  const others = b.enemiesInRadius(at.x, at.y, r).filter(a => a !== e && canTargetEnemy(u, a, plain));
  // S3's native alwaysIncludeTarget also retains the other enemies Pepe blocks,
  // including a blocked flyer or a victim outside the splash circle.
  if (n === 3) for (const a of u.blocking)
    if (a !== e && !others.includes(a) && canTargetEnemy(u, a, { ...plain, canHitFly: true })) others.push(a);
  for (const a of others) {
    strike(b, u, a, .5, info);
    const dodged = u.mem.pepeDodgeAttack === info.attackId && u.mem.pepeDodgeTarget === a;
    if (n === 3 && live(a) && !dodged) b.applyStatus(a, 'stun', { source: u, duration: u.skill.bb['attack@stun'] });
  }
  if (n === 3) {
    if (live(e) && !mainDodged) b.applyStatus(e, 'stun', { source: u, duration: u.skill.bb['attack@stun_main'] });
    u.mem.pepeStacks = Math.min(u.skill.bb['attack@max_stack_cnt'], (u.mem.pepeStacks ?? 0) + 1);
    b.addBuff(u, { key: 'pepe:s3-stacks', source: u, mods: { atkPct: u.mem.pepeStacks * u.skill.bb['attack@atk'] } });
  }
}
function transition(b, u, n, ending = false) {
  const token = {}, seq = u.deploySeq, name = `Skill_${n}_${ending ? 'End' : 'Begin'}`;
  u.mem.pepeTransition = token; u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'pepe:transition', flags: { disarm: true } });
  const epoch = u.attackControlEpoch;
  const watch = b.every(b.dt, () => {
    if (u.mem.pepeTransition !== token || !live(u)) { watch.cancel(); return; }
    if (!ending && (!u.canAct || u.attackControlEpoch !== epoch)) {
      watch.cancel(); u.skill.end('interrupt');
    }
  }, { owner: u });
  b.after(model(u).durations[name], () => {
    watch.cancel();
    if (!live(u) || u.deploySeq !== seq || u.mem.pepeTransition !== token) return;
    u.mem.pepeTransition = null; b.removeBuff(u, 'pepe:transition');
    if (ending) { u.mem.regularFormVisual = null; return; }
    const bb = u.skill.bb;
    b.addBuff(u, { key: 'pepe:mode', source: u, mods: n === 2
      ? { atkPct: bb.atk, aspd: bb.attack_speed + Math.min(bb.max_stack_cnt, u.mem.pepeUses ?? 0) * bb.attack_speed_extra }
      : { atkPct: bb.atk, batPct: bb.base_attack_time / u.base.bat } });
    if (n === 2) u.mem.pepeUses = (u.mem.pepeUses ?? 0) + 1;
    u.mem.regularFormVisual = { clip: `Skill_${n}_Idle`, loop: true };
    b.refreshRange(u);
  }, { owner: u });
}
function end(b, u, n, reason) {
  u.mem.pepeInput = null; u.mem.pepeS1Watch?.cancel(); u.mem.pepeS1Watch = null;
  u.mem.pepeTransition = null; u.mem.pepeStacks = 0;
  for (const key of ['pepe:mode', 'pepe:s3-stacks', 'pepe:transition', 'pepe:sp-lock']) b.removeBuff(u, key);
  if (!['death', 'retreat'].includes(reason)) refund(u); else u.mem.pepeKills = 0;
  if (n >= 2 && live(u) && reason !== 'interrupt') transition(b, u, n, true);
  else u.mem.regularFormVisual = null;
}
function windup(b, u, targets) {
  const name = clip(u), rate = attackRate(u);
  u.mem.pepeAttack = name; u.mem.pepeInput = targets[0];
  if (mode(u) === 1) {
    const seq = u.deploySeq, epoch = u.attackControlEpoch;
    u.mem.pepeS1Watch?.cancel();
    u.mem.pepeS1Watch = b.every(b.dt, () => {
      if (!u.skill.active || !u.skill.pending || u.deploySeq !== seq) { u.mem.pepeS1Watch.cancel(); return; }
      if (!live(u) || !u.canAct || epoch !== u.attackControlEpoch) u.skill.end('interrupt');
      else if (!live(u.mem.pepeInput)) { u.skill.end('target-dead'); u.skill.addCharge(1); }
    }, { owner: u });
  }
  return model(u).hits[name][0] / rate;
}
export function customizePepeKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, canHitFly: true,
    canTarget: (a, e) => !e.isFlying || e.blockedBy === a,
    install: null, hitsFn: null, allInRange: false, hitAllBlocked: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    acquireTargets: choose, launchAttack: launch, windup,
    canAttack: () => !u.mem.pepeTransition,
    attackVisual: () => u.mem.pepeAttack,
    afterAttack: (_b, a, _ts, info) => {
      if (mode(a) === 1 && a.skill.active) {
        a.mem.pepeS1Watch?.cancel(); a.mem.pepeS1Watch = null;
        if (a.mem.pepeFired !== info.attackId) { a.skill.end('target-dead'); a.skill.addCharge(1); }
        else {
          const seq = a.deploySeq, activation = a.skill.activations;
          const m = model(a), tail = (m.durations.Skill_1 - m.hits.Skill_1[0]) / attackRate(a);
          b.after(tail, () => { if (a.deploySeq === seq && a.skill.activations === activation) a.skill.end('cast'); }, { owner: a });
        }
      }
      a.mem.pepeInput = null;
    } };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = n === 1 ? { kind: 'instant', allowAbnormalCast: true,
    manualActivation: () => abnormal(u),
    canActivate: () => live(u) && !u.skill?.active && !u.s.flags.silence
      && (u.canAct || abnormal(u)) && (abnormal(u) || choose(b, u, plain).length > 0),
    attack: {}, onAttack: () => { u.skill.pending = false; },
    onStart: () => {
      for (const f of [...u.buffs]) if (resistable(f)) b.removeBuff(u, f.key);
      u.mem.pepeKills = 0; u.mem.pepeInput = choose(b, u, plain)[0] ?? null;
      b.addBuff(u, { key: 'pepe:sp-lock', flags: { noSp: true } });
    }, onEnd: ({ reason }) => end(b, u, n, reason) }
    : { kind: 'duration', trigger: 'NEVER', duration: s.duration,
      durationRemaining: () => Math.min(s.duration, u.skill.timeLeft),
      canActivate: () => live(u) && u.canAct && !u.s.flags.silence && !u.mem.pepeTransition,
      attack: {}, targeting: n === 2 ? { rangeGrid: s.rangeGrid } : null,
      onStart: () => {
        u.mem.pepeKills = 0; u.mem.pepeStacks = 0;
        u.skill.timeLeft += model(u).durations[`Skill_${n}_Begin`];
        transition(b, u, n);
      }, onEnd: ({ reason }) => end(b, u, n, reason) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installPepe({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t1 = def.talents.find(t => t.bb.max_sp != null)?.bb,
    aura = def.talents.find(t => t.bb.atk != null)?.bb.atk, recipients = new Set(), key = `pepe:aura:${u.id}`;
  const refresh = () => {
    for (const a of b.allyUnits) {
      const eligible = aura && live(u) && live(a) && a.kind === 'op' && a.def.profession === 'WARRIOR';
      if (eligible && !a.findBuff(key)) { b.addBuff(a, { key, source: u, mods: { atkPct: aura } }); recipients.add(a); }
    }
    for (const a of recipients) if (!live(u) || !live(a)) { b.removeBuff(a, key); recipients.delete(a); }
    if (u.skill?.active && u.skill.pending && u.mem.pepeInput && !live(u.mem.pepeInput)) {
      u.skill.end('target-dead'); u.skill.addCharge(1);
    }
  };
  b.on('tick', refresh, { owner: u }); b.on('deploy', refresh, { owner: u });
  b.on('kill', ({ killer }) => { if (killer === u && u.skill.active && t1) u.mem.pepeKills = (u.mem.pepeKills ?? 0) + 1; }, { owner: u });
  b.on('dodge', ({ source, target, dmg }) => { if (source === u) {
    u.mem.pepeDodgeAttack = dmg.attackId; u.mem.pepeDodgeTarget = target;
  } }, { owner: u });
  b.on('damaged', c => {
    if (c.target === u && live(u) && def.skill.id.endsWith('_3') && !u.skill.active
      && c.dmg.type !== 'element' && !c.dmg.noSp && !isHpLoss(c.dmg)) u.skill.gainSp(t1?.sp ?? 1, 'hurt');
  }, { owner: u });
  b.on('deploy', ({ unit }) => { if (unit === u) {
    u.mem.pepeUses = 0; u.mem.pepeStacks = 0; u.mem.pepeKills = 0; refresh();
  } }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) { end(b, u, 0, 'death'); refresh(); } }, { owner: u });
}
