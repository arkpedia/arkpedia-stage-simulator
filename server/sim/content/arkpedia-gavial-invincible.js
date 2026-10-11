// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-gavial-invincible-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_1026_gvial2';
const present = u => u?.alive && u.deployed;
const active = (u, n) => u.skill.active && u.skill.id === `skchr_gvial2_${n}`;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const components = (group, key) => evidence[group][key].flatMap(g => g.components).map(c => c.data);
const mover = components('projectiles', 'projectile_chr_gvial2_s2').find(c => c._keepUpdateTargetpos != null);
const puller = components('projectiles', 'projectile_chr_gvial2_s2').find(c => c._pullSourceOffset != null);
const debtPriority = components('skills', 'skchr_gvial2_3').flatMap(c => c._buffs ?? [])
  .find(c => c.buffKey === 'gvial2_s_3').onEventPriority;

function choose(b, u, p) {
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!targets.includes(e)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.gvialInput?.[0];
  if (targets.includes(input)) { targets.splice(targets.indexOf(input), 1); targets.unshift(input); }
  // Native allowZeroBlockCntLimit=false retains one target at zero block.
  return targets.slice(0, Math.max(1, Math.floor(u.s.blockCnt)));
}
function visual(b, u, clip, idle) {
  const token = {}, seq = u.deploySeq;
  u.mem.gvialVisual = token; u.mem.regularFormVisual = { clip, loop: false };
  b.after(model(u).durations[clip], () => {
    if (present(u) && u.deploySeq === seq && u.mem.gvialVisual === token)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null;
  }, { owner: u });
}
function pull(b, u, e) {
  if (!e.alive || e.blockedBy || e.blocking?.length) return;
  const anchor = { x: u.x, y: u.y }, life = e.deploySeq, force = u.skill.bb['attack@force'];
  // Invisible, fixed-destination, source-independent projectile. The native
  // animated MUZZLE point is not yet mapped to battlefield coordinates.
  b.addProjectile({ from: anchor, to: { x: e.x, y: e.y }, source: u,
    speed: mover._speed, maxAge: puller._lifeTime, visual: 'none',
    data: { arkpediaInvisible: true }, onHit: () => {
      if (e.alive && e.deployed && e.deploySeq === life && !e.blockedBy && !e.blocking?.length)
        b.pull(e, force, { to: anchor, center: anchor, stop: puller._pullSourceOffset });
    } });
}
function repay(b, u) {
  const debt = u.mem.gvialDebt ?? 0; u.mem.gvialDebt = 0;
  if (!present(u) || !(debt > 0)) return;
  const bb = u.skill.bb, amount = debt * bb.interval / bb.final_duration;
  // Direct PURE/NORMAL FixedValueDamage, not the ordinary damage pipeline:
  // skip modifiers, immunity/shields and SP. Tick before expiry includes the
  // final pulse; source DEFAULT/maxStackCnt=1 replaces an older bleed.
  b.addBuff(u, { key: 'gvial:bleed', source: u, duration: bb.final_duration, interval: bb.interval,
    data: { debt, amount }, onTick: () => applyHpLoss(b, u, u, amount,
      makeDamageInfo({ amount, type: 'true', isAttack: true, noSp: true, tags: ['gvial:bleed'] })) });
}
export function customizeGavialInvincibleKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', applyWay: 'melee', dmgType: 'phys', projectile: 'none',
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, canHitFly: true,
    canTarget: (a, e) => !e.isFlying || e.blockedBy === a, dmgMul: null, install: null,
    acquireTargets: choose, retargetOnRelease: true, interruptOnSkillChange: true,
    windup: (_b, a, targets) => {
      a.mem.gvialInput = targets;
      a.mem.gvialClip = active(a, 1) ? 'Skill_1' : active(a, 2)
        ? a.dir === 'DOWN' ? 'Skill_2_Loop_Down' : 'Skill_2_Loop' : active(a, 3) ? 'Skill_3' : 'Attack';
      return model(a).hits[a.mem.gvialClip][0] / (a.base.bat / a.s.interval);
    }, attackVisual: (_b, a) => a.mem.gvialClip,
    launchAttack: (_b, a, p, e, info) => {
      if (!canTargetEnemy(a, e, p)) return;
      const drag = active(a, 2);
      resolveHit(b, a, p, e, info, e.x, e.y);
      if (drag) pull(b, a, e);
    }, afterAttack: (_b, a) => { a.mem.gvialInput = null; } };
  const s = def.skill, bb = s.bb;
  kit.skill = { kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: { atkPct: bb.atk, ...(bb.def != null ? { defPct: bb.def } : {}),
      ...(bb.attack_speed != null ? { aspd: bb.attack_speed } : {}),
      ...(bb.block_cnt != null ? { blockCnt: bb.block_cnt } : {}) },
    ...(s.rangeGrid ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
    onStart: () => {
      // Source switch_mode_restart_fsm discards the unfinished old attack.
      u.atkCd = 0;
      if (s.id.endsWith('_2')) {
        visual(b, u, 'Skill_2_Begin', 'Skill_2_Idle');
        b.addBuff(u, { key: 'gvial:begin', source: u, duration: model(u).durations.Skill_2_Begin,
          flags: { disarm: true } });
      } else if (s.id.endsWith('_3')) u.mem.gvialDebt = 0;
    }, onEnd: () => {
      u.mem.gvialInput = null; u.atkCd = 0;
      b.removeBuff(u, 'gvial:begin'); u.mem.gvialVisual = null; u.mem.regularFormVisual = null;
      if (s.id.endsWith('_3')) repay(b, u);
      else if (s.id.endsWith('_2') && present(u)) visual(b, u, 'Skill_2_End', null);
    }, id: s.id, name: s.name };
}
export function installGavialInvincible({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const axe = def.talents.find(t => t.bb.atk_add != null)?.bb;
  const heal = def.talents.find(t => t.bb.heal_scale_1 != null)?.bb;
  function sync() {
    if (!axe || !present(u)) return;
    const count = u.blocking.filter(e => e.alive && e.blockedBy === u).length;
    if (u.mem.gvialBlocked === count && u.findBuff('gvial:axe')) return;
    u.mem.gvialBlocked = count;
    b.addBuff(u, { key: 'gvial:axe', source: u,
      mods: { atkPct: axe.atk + axe.atk_add * count, defPct: axe.def + axe.def_add * count } });
  }
  b.on('deploy', ({ unit }) => { if (unit === u) { u.mem.gvialDebt = 0; sync(); } }, { owner: u });
  for (const event of ['blocked', 'unblocked']) b.on(event, ({ blocker }) => {
    if (blocker === u) sync();
  }, { owner: u });
  b.on('heal', c => {
    if (heal && present(u) && c.target === u && !c.opts.regen)
      c.amount *= u.hpRatio >= heal.hp_ratio ? heal.heal_scale_1 : heal.heal_scale_2;
  }, { owner: u });
  b.on('damaged', c => {
    if (present(u) && c.source === u && active(u, 1) && c.amount > 0 && c.type !== 'element')
      b.heal(u, u, c.amount * u.skill.bb.heal_scale, { self: true });
  }, { owner: u });
  b.on('damageFinal', c => {
    if (c.target !== u || !present(u) || !active(u, 3) || !['phys', 'arts', 'true'].includes(c.dmg.type)) return;
    const removed = c.amount * u.skill.bb.damage_resistance;
    u.mem.gvialDebt = (u.mem.gvialDebt ?? 0) + removed; c.amount -= removed;
  }, { owner: u, priority: debtPriority });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => { if (unit === u) {
    u.mem.gvialDebt = 0; u.mem.gvialBlocked = null; u.mem.gvialVisual = null; u.mem.regularFormVisual = null;
    for (const key of ['gvial:axe', 'gvial:bleed', 'gvial:begin']) b.removeBuff(u, key);
  } }, { owner: u });
}
