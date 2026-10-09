// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-texas-alter-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_1028_texas2';
const live = u => u?.alive && u.deployed && !u.hidden;
const selected = u => Number(u.skill.id.at(-1));
const mode = u => u.skill.active ? selected(u) : 0;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const ground = { attack: 'melee', dmgType: 'phys', canHitFly: false, projectile: 'none' };
const area = { canHitFly: true };
const component = (skill, id) => evidence.skills[`skchr_texas2_${skill}`]
  .flatMap(g => g.components).find(c => c.pathId === id).data;
const burst2 = component(2, '7270813450026451546');
const burst3 = component(3, '455999309190585887');
const secondAttack = evidence.characters[ID].flatMap(g => g.components)
  .find(c => c.pathId === '1999289421131743912').data;
const rainBuff = component(3, '-9080013946467656161')._buffs[0];
const projectile = evidence.projectiles.projectile_chr_texas2_s3_sword_rain
  .flatMap(g => g.components).map(c => c.data).find(c => c._randomDelayToBorn != null);
const t1 = u => u.def.talents.find(t => t.bb.hp_ratio != null)?.bb;
const t2 = u => u.def.talents.find(t => t.bb.attack_speed != null)?.bb;
const owned = (u, name) => `texas2:${name}:${u.id}`;
function clip(u) { return mode(u) === 2 ? 'Skill_2_Loop' : mode(u) === 3 ? 'Skill_3_Loop' : 'Attack'; }
function surround(b, u, p, count = Infinity) {
  const keys = absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir);
  const victims = b.enemiesInKeys(keys, u, p);
  sortEnemyTargets(b, u, victims); return victims.slice(0, count);
}
function damage(b, u, e, scale, type, tag, info = {}, p = ground) {
  if (!canTargetEnemy(u, e, p)) return;
  b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale, type,
    applyWay: 'melee', isAttack: true, isSkill: true, attackId: info.attackId,
    ...info, tags: [tag] });
}
function drizzle(b, u, e) {
  const bb = u.skill.bb, prefix = 'attack@texas2_s_1[dot].';
  b.applyStatus(e, 'silence', { source: u, duration: bb['attack@silence'], sourceStatusResistable: false });
  // EXTEND retains the original tick phase, fixed damage and source; it does
  // not stack or take another snapshot. Target-owned DoT survives withdrawal.
  b.addBuff(e, { key: owned(u, 'dot'), source: u, duration: bb[prefix + 'duration'],
    refresh: 'extend', data: { accumulator: 0 },
    onTick: ({ buff, dt }) => {
      buff.data.accumulator += dt;
      while (buff.data.accumulator + 1e-9 >= bb[prefix + 'interval']) {
        buff.data.accumulator -= bb[prefix + 'interval'];
        b.dealDamage(u, e, { amount: bb[prefix + 'dot_damage'], type: 'arts',
          applyWay: 'buff', isAttack: false, isSkill: true, ignoreSelect: true,
          tags: ['texas2:dot'] });
      }
    } });
}
function launch(b, u, p, e, info) {
  const m = mode(u), seq = u.deploySeq, epoch = u.attackControlEpoch, activation = u.skill.activations, playback = rate(u);
  if (m === 1 && canTargetEnemy(u, e, p)) drizzle(b, u, e);
  damage(b, u, e, 1, m === 2 ? 'arts' : 'phys', 'texas2:attack',
    { ...info, isSkill: m > 0 }, p);
  if (m !== 2) return;
  // Native MultiMelee uses INPUT/START: second hit keeps this victim, even
  // if a better target appears. Never spend it on another blocked enemy.
  b.after(secondAttack._triggerDelta / playback, () => {
    if (live(u) && u.canAct && !u.s.flags.disarm && u.deploySeq === seq
      && u.attackControlEpoch === epoch && u.skill.activations === activation && mode(u) === 2)
      damage(b, u, e, 1, 'arts', 'texas2:attack', { ...info, isSkill: true }, p);
  }, { owner: u });
}
function end(b, u, reason) {
  u.mem.texasCast = null; b.removeBuff(u, owned(u, 'born'));
  if (!live(u) || ['death', 'retreat', 'recast'].includes(reason) || selected(u) === 1) {
    u.mem.regularFormVisual = null; return;
  }
  const name = `Skill_${selected(u)}_End`, seq = u.deploySeq, token = {};
  u.mem.texasVisual = token;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.after(model(u).durations[name], () => {
    if (u.deploySeq === seq && u.mem.texasVisual === token) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function sword(b, u, victim, scale, stun, tag) {
  // Released native projectile is not source-managed. Its retained target
  // can leave the range and its source can retreat before impact.
  const delay = b.rng() * projectile._randomDelayToBorn + projectile._lifeTime;
  b.after(delay, () => {
    if (!canTargetEnemy(u, victim, area)) return;
    b.applyStatus(victim, 'stun', { source: u, duration: stun, sourceStatusResistable: false });
    damage(b, u, victim, scale, 'arts', tag, { isProjectile: true }, area);
  });
}
function start(b, u, reason) {
  const s = u.skill, m = selected(u), seq = u.deploySeq;
  const token = { seq, activation: s.activations, epoch: u.attackControlEpoch,
    phaseEnd: b.time + (m === 1 ? model(u).durations.Start : 1 + b.dt), rain: 0 };
  u.mem.texasCast = token; u.mem.texasVisual = token;
  if (reason === 'recast') b.heal(u, u, u.s.maxHp * t1(u).hp_ratio,
    { self: true, skipModifierEvent: true });
  if (m === 1) b.addBuff(u, { key: owned(u, 'born'), source: u,
    duration: model(u).durations.Start, flags: { untargetable: true, noBlock: true } });
  // S2/S3 switch_mode_restart_fsm loses the ordinary born protection.
  const name = m === 1 ? 'Start' : m === 3 && reason === 'recast' ? 'Start_3_2' : `Start_${m}`;
  u.mem.regularFormVisual = { clip: name, loop: false, attack: 'none' };
  if (m > 1) s.timeLeft += 1 + b.dt;
  const valid = () => live(u) && u.deploySeq === seq && u.mem.texasCast === token && s.active;
  const castValid = () => valid() && u.canAct && u.attackControlEpoch === token.epoch;
  if (m > 1) {
    // One local simulation frame represents the source Sequence's event-gated
    // 1Frame child; preDelay/cooldown come from the following native child.
    // This is explicit adapter timing, not recovered compiled FSM parity.
    const burst = m === 2 ? burst2 : burst3, p = m === 2 ? ground : area;
    b.after(b.dt, () => {
      if (!castValid()) return;
      let victims = m === 2 ? surround(b, u, p) : null;
      const hit = () => {
        if (!castValid()) return;
        victims ??= surround(b, u, p);
        for (const e of victims) {
          if (!canTargetEnemy(u, e, p)) continue;
          if (m === 2) b.addBuff(e, { key: owned(u, 'res'), source: u,
            duration: s.bb.debuff_duration, refresh: 'extend', mods: { resMul: 1 + s.bb.magic_resistance } });
          else b.applyStatus(e, 'stun', { source: u, duration: s.bb['appear.stun'], sourceStatusResistable: false });
          damage(b, u, e, s.bb[m === 2 ? 'atk_scale' : 'appear.atk_scale'], 'arts', 'texas2:born', {}, p);
        }
      };
      b.after(burst._preDelay, hit, { owner: u });
      if (m === 3) b.after(burst._preDelay + burst._triggerDelta, hit, { owner: u });
    }, { owner: u });
  }
  b.after(token.phaseEnd - b.time, () => {
    if (!valid()) return;
    u.mem.regularFormVisual = m > 1 ? { clip: `Skill_${m}_Idle`, loop: true } : null;
    u.atkCd = 0;
  }, { owner: u });
}
export function customizeTexasAlterKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...ground, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false,
    rangeAoe: false, dmgMul: null, heal: null, install: null,
    interruptOnSkillChange: true, retargetOnRelease: false,
    canAttack: () => !u.mem.texasCast || b.time + 1e-9 >= u.mem.texasCast.phaseEnd,
    attackVisual: (_b, a) => clip(a),
    windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), launchAttack: launch };
  const s = def.skill, talent = def.talents.find(t => t.bb.hp_ratio != null)?.bb;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    spType: 'none', trigger: 'NEVER', hideInactiveHud: true,
    durationRemaining: () => u.skill.timeLeft - (selected(u) > 1 && u.mem.texasCast
      ? Math.max(0, u.mem.texasCast.phaseEnd - b.time) : 0),
    canActivate: () => !!u.mem.texasPermission && live(u) && u.canAct && !u.s.flags.silence,
    mods: { atkPct: (s.bb.atk ?? 0) + (talent?.atk ?? 0) },
    onStart: ({ reason }) => start(b, u, reason), onEnd: ({ reason }) => end(b, u, reason),
    onTick: ({ dt }) => {
      const token = u.mem.texasCast;
      if (!token || selected(u) !== 3 || b.time < token.phaseEnd - 1e-9) return;
      // Literal firstTriggerInterval .4 precedes the selected 1-second clock.
      // _checkCanUseAblityFlag=false: the attached rain is not an ordinary
      // attack and remains live under disarm/control, as its native buff does.
      token.rain += dt;
      const first = !token.rainStarted, interval = first ? rainBuff.firstTriggerInterval : s.bb['texas2_s_3[sword].interval'];
      if (token.rain + 1e-9 < interval) return;
      token.rain -= interval; token.rainStarted = true;
      for (const e of surround(b, u, area, s.bb.max_target)) sword(b, u, e, s.bb.atk_scale, s.bb.stun, 'texas2:rain');
    } };
}
function activate(b, u, reason) {
  u.mem.texasPermission = true;
  try { return u.skill.activate(reason, { free: true }); }
  finally { u.mem.texasPermission = false; }
}
export function installTexasAlter({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.texasResetUsed = false; u.mem.texasPendingReset = false; u.mem.texasCast = null;
    u.skill.charges = 0;
    const talent = t2(u);
    if (talent) b.addBuff(u, { key: owned(u, 'swordsmanship'), source: u,
      status: 'sanctuary', data: { value: talent.damage_resistance },
      mods: { aspd: talent.attack_speed, physTakenMul: 1 - talent.damage_resistance,
        artsTakenMul: 1 - talent.damage_resistance, trueTakenMul: 1 - talent.damage_resistance,
        elementalTakenMul: 1 - talent.damage_resistance } });
    u.mem.texasPendingDeploy = !activate(b, u, 'deploy');
    const seq = u.deploySeq;
    // Source recast_after_born polls every .03s. Wait through the cast phase
    // and abnormal states; a first kill cannot recursively recast mid-burst.
    b.every(.029999999329447746, () => {
      if (!live(u) || u.deploySeq !== seq) return;
      if (!u.canAct || u.s.flags.silence) return;
      if (u.mem.texasPendingDeploy) {
        if (activate(b, u, 'deploy')) u.mem.texasPendingDeploy = false;
      } else if (u.mem.texasPendingReset && (!u.mem.texasCast || b.time >= u.mem.texasCast.phaseEnd - 1e-9)) {
        if (u.skill.active) u.skill.end('recast');
        if (activate(b, u, 'recast')) u.mem.texasPendingReset = false;
      }
    }, { owner: u });
  }, { owner: u });
  b.on('death', ({ unit, reason, killer }) => {
    // Confirmed removal rather than the speculative kill hook: a revived
    // victim has not been defeated and must not spend either talent.
    if (reason !== 'killed' || unit.side !== 'enemy' || killer !== u || !live(u)) return;
    b.removeBuff(u, owned(u, 'swordsmanship'));
    if (t1(u) && !u.mem.texasResetUsed) {
      u.mem.texasResetUsed = true; u.mem.texasPendingReset = true;
    }
  }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    u.mem.texasCast = null; u.mem.texasPendingReset = false; u.mem.texasPendingDeploy = false;
    u.mem.regularFormVisual = null; b.removeBuff(u, owned(u, 'swordsmanship'));
  }, { owner: u });
}
