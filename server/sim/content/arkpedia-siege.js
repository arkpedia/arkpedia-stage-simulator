// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs, retained investigations and explicit simulator fallback laws:
// data/arkpedia-siege-prefabs.json. No native frame/dispatcher parity claim.
import evidence from '../../../data/arkpedia-siege-prefabs.json' with { type: 'json' };
import { compileBuffTemplate } from '../../../shared/arkpedia/behavior.js';
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys } from '../targeting.js';

const ID = 'char_112_siege', SECOND = 'skchr_siege_2', THIRD = 'skchr_siege_3';
const live = u => u?.alive && u.deployed && !u.hidden;
const rate = u => Math.min(1, u.s.aspd / 100);
const model = u => evidence.models[u.dir === 'UP' ? 'Back' : 'Front'];
const grant = compileBuffTemplate(evidence.buffTemplates.charge_cost);
function clearCast(b, u, state) {
  if (!state || u.mem.siegeCast !== state) return;
  u.mem.siegeCast = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'siege:cast');
}
function windup(b, u) {
  if (u.skill.pending && u.skill.id === SECOND) {
    const playback = rate(u), front = evidence.models.Front;
    const state = { deployment: u.deploySeq, control: u.attackControlEpoch, released: false };
    u.mem.siegeCast = state;
    // Back has no Skill clip. Retain its actual Idle visual and use the known
    // Front clock as an explicit fallback, never fabricate a Back OnAttack.
    u.mem.regularFormVisual = { clip: model(u).durations.Skill ? 'Skill' : 'Idle', loop: false, speed: playback };
    u.mem.siegeAttackVisual = model(u).durations.Skill ? 'Skill' : 'Idle';
    b.addBuff(u, { key: 'siege:cast', flags: { noSp: true } });
    b.after(front.durations.Skill / playback, () => clearCast(b, u, state), { owner: u });
    // Bound the original preparation and attack event as overlapping clocks.
    return Math.max(evidence.nativeBoundaries.s2Predelay, front.hits.Skill[0]) / playback;
  }
  const animation = u.skill.active && u.skill.id === THIRD ? 'Attack_2' : 'Attack';
  u.mem.siegeAttackVisual = animation;
  return model(u).hits[animation][0] / rate(u);
}
export function customizeSiegeKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, hits: 1, hitAllBlocked: false, maxTargetsByBlock: false, splashRadius: 0,
    chain: null, dmgMul: null, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.siegeCast, windup, attackVisual: () => u.mem.siegeAttackVisual };
  const s = def.skill, bb = s.bb;
  if (s.id === SECOND) kit.skill = {
    kind: 'instant', charges: bb.ct, canActivate: () => !u.mem.siegeCast,
    targeting: { rangeGrid: s.rangeGrid, showOwnRange: true },
    attack: { allInRange: true, atkScale: bb.atk_scale, retargetOnRelease: true,
      afterAttack: () => {
        const cast = u.mem.siegeCast;
        if (!cast || cast.released) return;
        cast.released = true;
        grant.run('ON_BUFF_START', { battle: b, unit: u, blackboard: { cost: bb.cost } });
      } },
  };
  else if (s.id === THIRD) kit.skill = { kind: 'duration', duration: s.duration,
    mods: { batFlat: bb.base_attack_time },
    attack: { atkScale: bb['attack@atk_scale'], onHit: ({ target }) => {
      if (b.rng.chance(bb['attack@buff_prob'])) b.applyStatus(target, 'stun', { source: u, duration: bb['attack@stun'] });
    } } };
  else kit.skill = { kind: 'instant', onStart: ctx => grant.run('ON_BUFF_START', { ...ctx, blackboard: bb }) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installSiege({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  // Normalised runtime talents retain selected fields but omit prefabKey.
  const talent = def.talents.find(t => t.bb.atk != null && t.bb.def != null)?.bb;
  const crushing = def.talents.find(t => t.bb.sp != null);
  const key = `siege:king:${u.id}`;
  const sync = () => {
    for (const a of b.allyUnits) {
      const valid = talent && live(u) && live(a) && a.def.profession === 'PIONEER';
      if (!valid) b.removeBuff(a, key);
      else if (!a.findBuff(key)) b.addBuff(a, { key, source: u, mods: { atkPct: talent.atk, defPct: talent.def } });
    }
  };
  b.on('deploy', sync, { owner: u });
  b.on('tick', () => {
    sync(); const cast = u.mem.siegeCast;
    if (cast && (!live(u) || !u.canAct || u.s.flags.disarm || u.attackControlEpoch !== cast.control)) {
      clearCast(b, u, cast);
      if (u.skill.pending) u.skill.end('interrupted');
    }
  }, { owner: u });
  b.on('death', ({ unit: dead, reason }) => {
    if (dead === u) { clearCast(b, u, u.mem.siegeCast); sync(); return; }
    if (!crushing || !live(u) || dead.side !== 'enemy' || dead.hidden || reason !== 'killed') return;
    const keys = new Set(absoluteRangeKeys(crushing.rangeGrid, u.tileR, u.tileC, 'RIGHT'));
    if (bodyInKeys(dead, keys))
      // Native ModifySp forceFlagtrue, BUFF_SOURCE, ALL: bypass ordinary no-SP
      // and timed-skill gates, preserving the normal charge-cap invariants.
      u.skill.gainSp(crushing.bb.sp, 'init', true);
  }, { owner: u });
}
