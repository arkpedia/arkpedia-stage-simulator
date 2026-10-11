// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs, authored gameplay notes and bounded FSM mapping:
// data/arkpedia-iana-prefabs.json. No generic Dollkeeper fatal cycle is used.
import evidence from '../../../data/arkpedia-iana-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { resolveHit } from '../ai.js';
import { rotateOffset } from '../dir.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_4124_iana';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100;
const key = (u, role) => `iana:${role}:${u.id}`;
const range = evidence.tables.ranges['x-1'].grids.map(p => [p.row, p.col]);
const second = u => u.skill.id === 'skchr_iana_2';
function idle(u) {
  u.mem.regularFormVisual = { clip: u.trait.doll ? 'Doll_Idle' : 'Idle', loop: true,
    attack: 'Doll_Attack_Loop', die: 'Doll_Die' };
}
function syncAura(b, u) {
  const active = live(u) && !!u.findBuff(key(u, 'special'));
  for (const e of b.enemies) {
    const inside = active && live(e) && bodyInKeys(e, u.rangeKeys);
    if (!inside) b.removeBuff(e, key(u, 'aura'));
    else if (!e.findBuff(key(u, 'aura'))) b.addBuff(e, {
      key: key(u, 'aura'), source: u, flags: { reveal: true } });
  }
}
function blast(b, u, attacker) {
  // Native marked selector ignores selectability, but a removed attacker
  // cannot provide its target position. The authored note supplies range1-1.
  const target = live(attacker) ? attacker : u;
  const centre = { x: target.x, y: target.y };
  b.addProjectile({ from: u, to: centre, source: u, speed: 5, maxAge: 10,
    visual: 'bomb', data: { arkpediaTrackedVisual: true }, onHit: () => {
      // Once born, the original projectile is independent of its source.
      b.after(.2, () => {
        for (const e of b.enemies) {
          if (!canTargetEnemy(u, e, { canHitFly: true })) continue;
          const inside = evidence.tables.ranges['1-1'].grids.some(p => {
            const [dr, dc] = rotateOffset(p.row, p.col, 'UP');
            return Math.abs(e.x - centre.x - dc) < .5
              && Math.abs(e.y - centre.y - dr) < .5;
          });
          if (inside) b.dealDamage(u, e, { amount: u.s.atk * u.def.skill.bb.atk_scale,
            type: 'phys', isAttack: true, isSkill: true, applyWay: 'ranged', tags: ['iana:blast'] });
        }
      });
    } });
}
function switchForm(b, u, doll, special = false, attacker = null) {
  const state = { seq: u.deploySeq }; u.mem.ianaSwitch = state;
  u.trait.dollSwitching = true; u.mem.ianaOpened = false;
  u.mem.ianaAttackEnd = null;
  u.mem.ianaReturnAt = null;
  if (u.skill.active && u.skill.kind !== 'passive') u.skill.end('substitute');
  for (const buff of u.buffs.slice()) if (!buff.persist) b.removeBuff(u, buff);
  u.skill.setSpTotal(0);
  syncAura(b, u);
  b.addBuff(u, { key: key(u, 'transition'), flags: { invulnerable: true,
    undeadable: true, noSp: true, noHeal: true, healFree: true, isolated: true, disarm: true } });
  if (doll) b.addBuff(u, { key: key(u, 'zero-block'), mods: { blockCntMul: 0 } });
  b.releaseBlocked(u); u.hp = u.s.maxHp;
  const valid = () => live(u) && u.deploySeq === state.seq && u.mem.ianaSwitch === state;
  const out = doll ? special ? 'Skill_2_SwitchOut' : 'Skill_1_SwitchOut' : 'Doll_SwitchOut';
  const born = doll ? special ? 'Doll_Skill_2_SwitchIn' : 'Doll_Skill_1_SwitchIn' : 'Start';
  // Back has no outgoing clips. Retain the actual Front identity for this phase.
  u.mem.regularFormVisual = { clip: out, loop: false, speed: 1, forceFront: true };
  b.after(evidence.models[ID].Front.durations[out], () => {
    if (!valid()) return;
    u.trait.doll = doll; u.form = doll ? 'doll' : null;
    u.rangeGrid = doll ? range : u.def.rangeGrid; b.refreshRange(u);
    if (doll) {
      b.addBuff(u, { key: key(u, 'zero-block'), mods: { blockCntMul: 0 } });
      b.addBuff(u, { key: key(u, 'substitute-sp'), flags: { noSp: true } });
      u.mem.ianaReturnAt = b.time + u.def.traitBb.duration;
      b.after(u.def.traitBb.duration, () => {
        if (valid() && u.trait.doll) switchForm(b, u, false);
      }, { owner: u });
    } else b.removeBuff(u, key(u, 'zero-block'));
    u.mem.regularFormVisual = { clip: born, loop: false, speed: 1 };
    if (doll) b.after(model(u).hits[born][0], () => {
      if (!valid()) return;
      if (!special && !second(u)) blast(b, u, attacker);
      if (special && !u.s.flags.reveal) {
        b.addBuff(u, { key: key(u, 'special'), duration: u.def.skill.duration,
          mods: { aspd: u.def.skill.bb.attack_speed }, flags: { stealth: true },
          onRemove: () => syncAura(b, u) });
        syncAura(b, u);
      }
    }, { owner: u });
    b.after(model(u).durations[born], () => {
      if (!valid()) return;
      b.removeBuff(u, key(u, 'transition')); u.trait.dollSwitching = false;
      idle(u); u.atkCd = 0;
    }, { owner: u });
  }, { owner: u });
}
export function customizeIanaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', dmgType: 'phys', projectile: 'none',
    applyWay: 'ranged', groundOnly: false, canHitFly: true, hits: 1, hitsFn: null,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, splashRadius: 0,
    allInRange: false, rangeAoe: false, chain: null, dmgMul: null,
    interruptOnSkillChange: true, retargetOnRelease: false,
    canAttack: () => u.trait.doll && !u.trait.dollSwitching && !u.mem.ianaAttackEnd,
    windup: () => {
      const first = !u.mem.ianaOpened; u.mem.ianaOpened = true;
      const down = u.dir === 'DOWN', m = model(u);
      const loop = down ? 'Doll_Attack_Loop_Down' : 'Doll_Attack_Loop';
      const begin = down ? 'Doll_Attack_Begin_Down' : 'Doll_Attack_Begin';
      const lead = first ? m.durations[begin] / rate(u) : 0;
      u.mem.ianaAnimationEnd = b.time + lead + m.durations[loop] / rate(u);
      u.mem.ianaAttackVisual = first ? { begin, loop, beginDuration: lead } : loop;
      return lead + m.hits[loop][0] / rate(u);
    }, attackVisual: () => u.mem.ianaAttackVisual,
    launchAttack: (battle, unit, p, e, info) => {
      if (!canTargetEnemy(unit, e, p)) return;
      battle.addProjectile({ from: unit, target: e, source: unit, speed: 30, maxAge: 10,
        visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
          if (target && canTargetEnemy(unit, target, p)) resolveHit(battle, unit,
            { ...p, launchAttack: null }, target, info, target.x, target.y);
        } });
    } };
  kit.skill = { id: def.skill.id, name: def.skill.name,
    kind: def.skill.id.endsWith('_1') ? 'passive' : 'instant', trigger: 'NEVER',
    canActivate: () => live(u) && !u.trait.doll && !u.trait.dollSwitching
      && u.canAct && !u.s.flags.silence,
    onStart: () => { if (second(u)) switchForm(b, u, true, true); },
    formCountdown: () => live(u) && u.mem.ianaReturnAt != null
      ? { remaining: Math.max(0, u.mem.ianaReturnAt - b.time), duration: def.traitBb.duration,
        label: 'Substitute remaining' } : null };
}
export function installIana({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const talent = def.talents[0].bb;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.trait.doll = false; u.trait.dollSwitching = false; u.mem.ianaSwitch = null;
    u.mem.ianaReturnAt = null; u.mem.ianaOpened = false; u.mem.ianaAttackEnd = null;
    idle(u);
  }, { owner: u });
  b.on('hit', ({ source, target, dmg }) => {
    if (target !== u || !live(u) || u.trait.doll || u.trait.dollSwitching
      || source?.side !== 'enemy' || dmg.cancel) return;
    b.addBuff(source, { key: key(u, 'talent-reveal'), source: u,
      duration: talent.duration, flags: { reveal: true } });
    if (talent['weak[limit]'] > 0) b.applyStatus(source, 'fragile', {
      key: key(u, 'fragile'), source: u, duration: talent['weak[limit]'], value: talent.damage_scale - 1 });
    if (!second(u) || !u.skill.activate('incoming-damage')) switchForm(b, u, true, false, source);
  }, { owner: u });
  b.on('fatal', ctx => {
    if (ctx.unit !== u || ctx.prevented || u.trait.doll) return;
    if (!u.trait.dollSwitching) switchForm(b, u, true);
    ctx.prevented = true;
  }, { owner: u, priority: -100 });
  b.on('beforeStatus', ctx => {
    if (ctx.target === u && u.trait.dollSwitching && ['stun', 'freeze', 'sleep'].includes(ctx.status)) ctx.cancel = true;
  }, { owner: u });
  b.on('beforeBuff', ({ unit, buff }) => {
    if (unit === u && buff.flags?.reveal) { b.removeBuff(u, key(u, 'special')); syncAura(b, u); }
  }, { owner: u });
  b.on('tick', () => {
    if (u.s.flags.reveal) b.removeBuff(u, key(u, 'special'));
    syncAura(b, u);
    const targets = live(u) && u.canAct && u.trait.doll && !u.trait.dollSwitching
      && b.enemiesInKeys(u.rangeKeys, u, u.profile).length;
    if (!targets && u.mem.ianaOpened && !u.trait.dollSwitching
      && b.time >= (u.mem.ianaAnimationEnd ?? 0)) {
      u.mem.ianaOpened = false;
      const state = {}; u.mem.ianaAttackEnd = state;
      const clip = u.dir === 'DOWN' ? 'Doll_Attack_End_Down' : 'Doll_Attack_End';
      u.mem.regularFormVisual = { clip, loop: false, speed: rate(u) };
      b.after(model(u).durations[clip] / rate(u), () => {
        if (live(u) && u.mem.ianaAttackEnd === state && !u.trait.dollSwitching) {
          u.mem.ianaAttackEnd = null; idle(u);
        }
      }, { owner: u });
    }
  }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    u.mem.ianaSwitch = null; u.mem.ianaReturnAt = null; u.mem.ianaAttackEnd = null;
    u.mem.ianaOpened = false; u.mem.regularFormVisual = null;
    u.trait.doll = false; u.trait.dollSwitching = false; u.form = null; syncAura(b, u);
  }, { owner: u });
}
