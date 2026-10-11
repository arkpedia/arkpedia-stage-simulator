// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_VANGUARD_THIRD_OPERATORS } from '../../../shared/arkpedia/five-star-vanguard-third-operators.js';
import evidence from '../../../data/arkpedia-five-star-vanguard-third-prefabs.json' with { type: 'json' };
import { resolveHit, enforceBlockCapacity } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const W = 'char_4119_wanqin', C = 'char_497_ctable';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const healable = (b, u, a) => live(a) && a.kind !== 'device' && !a.s.flags.untargetable && b.allySelectable(a, u)
  && !a.s.flags.healFree && !((a.s.flags.noHeal || a.profile?.noHeal) && a !== u);
// Both native aura validators ignore target-free and ally-target-free, unlike
// the skill's independent ordinary HEAL selector. Heal-free still applies.
const auraEligible = a => live(a) && a.kind !== 'device' && !a.s.flags.healFree
  && !(a.s.flags.noHeal || a.profile?.noHeal);
function setMods(b, a, key, mods, source) {
  if (!mods) { b.removeBuff(a, key); return; }
  if (JSON.stringify(a.findBuff(key)?.mods) !== JSON.stringify(mods)) b.addBuff(a, { key, source, mods });
}
function form(b, u, begin, loop) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[begin];
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'vanguard-third:begin', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
}
function endForm(b, u, clip, reason) {
  b.removeBuff(u, 'vanguard-third:begin');
  if (!live(u) || !['duration', 'manual', 'ammo'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[clip];
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'vanguard-third:end', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function wanqingAura(b, u, def) {
  const talent = def.talents[0], key = `wanqing:HP:${u.id}`, aspd = `wanqing:ASPD:${u.id}`;
  const keys = new Set(absoluteRangeKeys(talent?.rangeGrid ?? def.skill.rangeGrid ?? [], u.tileR, u.tileC, u.dir));
  for (const a of b.allyUnits) {
    const eligible = live(u) && a !== u && auraEligible(a) && bodyInKeys(a, keys);
    setMods(b, a, key, eligible && talent ? { hpPct: talent.bb['wanqin_t_1[hp_common].max_hp']
      + (a.dir === u.dir ? talent.bb['wanqin_t_1[hp_common].wanqin_t_1[hp_extra].max_hp'] : 0) } : null, u);
    setMods(b, a, aspd, eligible && u.skill.active && def.skill.id === 'skchr_wanqin_2' && a.dir === u.dir
      ? { aspd: def.skill.bb['attack@attack_speed'] } : null, u);
  }
}
const combat = (u, targets) => targets?.some(e => e.blockedBy === u);
function clip(u, targets) {
  const second = u.skill.active && u.skill.id === 'skchr_ctable_2';
  if (second && combat(u, targets) && u.dir === 'DOWN') return 'Skill_2_Down';
  return `${second ? 'Skill_2_' : ''}${combat(u, targets) ? 'Combat' : 'Attack'}`;
}
function cantabileLaunch(b, u, p, target, info) {
  const hit = { ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null,
    applyWay: target.blockedBy === u ? 'melee' : 'ranged' };
  if (target.blockedBy === u) resolveHit(b, u, hit, target, info, target.x, target.y);
  else {
    const projectile = b.addProjectile({ from: u, target, source: u, speed: 10, visual: 'arrow',
      data: { arkpediaTrackedVisual: true }, onHit: ({ target, x, y }) => {
        if (target && canTargetEnemy(u, target, p)) resolveHit(b, u, hit, target, info, x, y);
      } });
    if (info.isSkill && u.skill.id === 'skchr_ctable_2') u.mem.cantabileFlights.push(projectile);
  }
}
function consumeCantabile(ctx) {
  const { battle: b, unit: u, skill, noAmmo } = ctx;
  ctx.noAmmo = true;
  if (noAmmo || !skill.active) return;
  skill.ammoLeft = Math.max(0, skill.ammoLeft - 1);
  if (skill.ammoLeft) return;
  const seq = u.deploySeq, activation = skill.activations;
  const tail = (model(u).durations.Skill_2_Attack - model(u).hits.Skill_2_Attack[0]) / Math.min(1, u.s.aspd / 100);
  const until = b.time + tail;
  b.addBuff(u, { key: 'cantabile:last-ammo', flags: { disarm: true } });
  const watch = b.every(b.dt, () => {
    if (!live(u) || u.deploySeq !== seq || !skill.active || skill.activations !== activation) { watch.cancel(); return; }
    u.mem.cantabileFlights = u.mem.cantabileFlights.filter(p => b.projectiles.list.includes(p));
    if (b.time + 1e-9 >= until && !u.mem.cantabileFlights.length) { watch.cancel(); skill.end('ammo'); }
  }, { owner: u });
}
export function customizeFiveStarVanguardThirdKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_VANGUARD_THIRD_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb;
  kit.install = null;
  kit.trait = { attack: id === C ? 'ranged' : 'melee', projectile: id === C ? 'arrow' : 'none', dmgType: 'phys',
    canHitFly: id === C, maxTargets: 1, hitAllBlocked: false, hits: 1, hitsFn: null,
    splashRadius: 0, chain: null, allInRange: false, rangeAoe: false, interruptOnSkillChange: true,
    windup: (_b, unit, targets) => model(unit).hits[id === W ? 'Attack' : clip(unit, targets)][0]
      / Math.min(id === C && unit.skill.active && s.id.endsWith('_2') ? 1 : Infinity, unit.s.aspd / 100),
    attackVisual: (_b, unit, targets) => id === W ? 'Attack' : clip(unit, targets) };
  if (id === W) {
    let elapsed = 0, grants = 0, nextHeal = .533;
    const second = s.id === 'skchr_wanqin_2', interval = second ? bb['wanqin_s_2[cost].interval'] : bb.interval;
    kit.skill = { kind: 'duration', mods: { blockCntMul: 0 }, attack: { noAttack: true },
      onStart: () => { elapsed = grants = 0; nextHeal = .533;
        form(b, u, 'Skill_Begin', 'Skill_Loop'); enforceBlockCapacity(b, u); wanqingAura(b, u, def); },
      onTick: ({ dt, skill }) => {
        elapsed += Math.min(dt, Math.max(0, skill.timeLeft));
        while (grants < bb.value && elapsed + 1e-9 >= (grants + 1) * interval) { grants++; b.addDp(u.ownerId, 1); }
        if (second) while (elapsed + 1e-9 >= nextHeal) {
          nextHeal += 1;
          if (!u.canAct) continue;
          const keys = new Set(absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir));
          for (const a of b.allyUnits) if (healable(b, u, a) && bodyInKeys(a, keys))
            b.heal(u, a, u.s.atk * bb['attack@heal_scale']);
        }
      }, onEnd: ({ reason }) => {
        for (const a of b.allyUnits) b.removeBuff(a, `wanqing:ASPD:${u.id}`);
        endForm(b, u, 'Skill_End', reason);
      } };
  } else {
    kit.trait.launchAttack = cantabileLaunch;
    const second = s.id === 'skchr_ctable_2';
    kit.skill = { kind: second ? 'ammo' : 'duration', mods: { atkPct: bb.atk, aspd: bb.attack_speed },
      ...(second ? { ammo: bb['attack@trigger_time'], duration: 0, manualCancel: true,
        onAttack: consumeCantabile,
        onStart: () => { u.mem.cantabileFlights = []; form(b, u, 'Skill_2_Begin', 'Skill_2_Idle'); },
        onEnd: ({ reason }) => {
          b.removeBuff(u, 'cantabile:camo'); b.removeBuff(u, 'cantabile:last-ammo');
          endForm(b, u, 'Skill_2_End', reason);
        } } : { activateOnDeploy: true, spType: 'none', trigger: 'NEVER', isExhausted: () => u.skill?.activations >= 1 }) };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installFiveStarVanguardThird({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_VANGUARD_THIRD_OPERATORS[def.charId]) return;
  if (def.charId === W) {
    for (const event of ['deploy', 'tick', 'death']) b.on(event, () => wanqingAura(b, u, def), { owner: u });
  } else {
    const talent = def.talents[0]?.bb;
    const sync = () => setMods(b, u, 'cantabile:talent', live(u) && talent
      ? u.blocking.some(e => e.alive && e.blockedBy === u) ? { atkPct: talent.atk } : { aspd: talent.attack_speed } : null, u);
    for (const event of ['deploy', 'tick']) b.on(event, sync, { owner: u });
    b.every(.1, () => {
      if (!live(u) || !u.skill.active || def.skill.id !== 'skchr_ctable_2') { b.removeBuff(u, 'cantabile:camo'); return; }
      if (u.blocking.some(e => e.alive && e.blockedBy === u)) b.removeBuff(u, 'cantabile:camo');
      else if (!u.findBuff('cantabile:camo')) b.addBuff(u, { key: 'cantabile:camo', source: u, flags: { camou: true } });
    }, { owner: u });
    b.on('damaged', ({ source, target, dmg }) => {
      if (source === u && live(u) && u.skill.active && target.side === 'enemy' && dmg?.isAttack && dmg.type === 'phys')
        b.addDp(u.ownerId, def.skill.bb.cost);
    }, { owner: u });
  }
}
