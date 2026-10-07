// SPDX-License-Identifier: GPL-3.0-or-later
import { SNIPER_SIX_STAR_SECOND_OPERATORS } from '../../../shared/arkpedia/sniper-six-star-second-operators.js';
import evidence from '../../../data/arkpedia-sniper-six-star-second-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
// Original timeMode0 and maxAnimScale constrain playback; the two selected S3
// BAT additions influence the current attack interval as well as ASPD.
const rate = (u, cap = 2) => Math.min(cap, u.base.bat / u.s.interval);
const windup = cap => (_b, u) => model(u).hits.Attack[0] / rate(u, cap);
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0 });

function flight(b, u, p, target, info) {
  return b.addProjectile({ from: u, target, source: u, speed: 30, maxAge: 5,
    visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e, x, y }) => {
      if (e && canTargetEnemy(u, e, p)) resolveHit(b, u, plain(p), e, info, x, y);
    } });
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  if (!info.isSkill) {
    // Original default mode binds a direct attack, without projectileKey.
    resolveHit(b, u, plain(p), target, info, target.x, target.y);
    return;
  }
  u.mem.exusiaiEmittedAttackId = info.attackId;
  const bb = u.def.skill.bb;
  const count = bb.times ?? bb['attack@times'];
  const seq = u.deploySeq, activation = u.skill.activations, control = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.canAct
    && u.attackControlEpoch === control && u.skill.activations === activation;
  flight(b, u, p, target, info);
  // Native triggerDelta .05/waitAttackEventForAllAttacks0 releases follow-up
  // rounds independently of additional animation events. Source
  // interruptAbilityOnDetach0 retains this already-started burst at mode end. Once controlled,
  // unfired rounds never resume; emitted projectiles retain their source.
  let canceled = false;
  const watch = b.every(b.dt, () => { if (!valid()) canceled = true; }, { owner: u });
  for (let i = 1; i < count; i++) b.after(i * .05000000074505806, () => {
    if (!canceled && valid() && canTargetEnemy(u, target, p)) flight(b, u, p, target, info);
    if (i === count - 1) watch.cancel();
  }, { owner: u });
}

export function customizeSniperSixStarSecondKit({ id, def, unit: u, kit }) {
  if (!SNIPER_SIX_STAR_SECOND_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    priority: 'fly', hits: 1, hitsFn: null, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, splashRadius: 0,
    chain: null, dmgMul: null, install: null, retargetOnRelease: true,
    interruptOnSkillChange: true, launchAttack: launch, attackVisual: 'Attack', windup: windup(2) };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_angel_1') kit.skill = { kind: 'instant',
    attack: { atkScale: bb.atk_scale, windup: windup(1),
      afterAttack: (_b, unit, _targets, meta) => {
        if (unit.mem.exusiaiEmittedAttackId !== meta.attackId
          && meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
      } } };
  else kit.skill = { kind: 'duration', duration: s.duration,
    ...(s.id === 'skchr_angel_3' ? { mods: { batFlat: 2 * bb.base_attack_time } } : {}),
    attack: { atkScale: bb['attack@atk_scale'] } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installSniperSixStarSecond({ battle: b, unit: u, def }) {
  if (!SNIPER_SIX_STAR_SECOND_OPERATORS[def.charId]) return;
  const speed = def.talents.find(t => t.bb.attack_speed != null)?.bb;
  if (speed) b.addBuff(u, { key: 'exusiai:cartridge', persist: true, allowDead: true,
    source: u, mods: { aspd: speed.attack_speed } });
  const blessing = def.talents.find(t => t.bb.max_hp != null)?.bb;
  if (!blessing) return;
  const key = `exusiai:blessing:${u.id}`;
  b.addBuff(u, { key, source: u, persist: true, allowDead: true,
    mods: { atkPct: blessing.atk, hpPct: blessing.max_hp } });
  let chosen = null, attached = false;
  const legal = a => live(a) && a !== u && a.kind === 'op' && b.allySelectable(a, u)
    && Math.hypot(a.x - u.x, a.y - u.y) <= 30;
  b.on('deploy', ({ unit }) => {
    if (unit !== u || attached) return;
    attached = true;
    // Primary Global wording specifies a random already-deployed ally when
    // Exusiai is deployed. Native replacement ordering is unrecovered; do not
    // invent continuous recipients or a delayed roll when the field is empty.
    chosen = b.rng.pick(b.allyUnits.filter(legal)) ?? null;
    if (chosen) b.addBuff(chosen, { key, source: u,
      mods: { atkPct: blessing.atk, hpPct: blessing.max_hp } });
  }, { owner: u });
  const sync = () => {
    if (chosen && (!live(u) || !legal(chosen))) { b.removeBuff(chosen, key); chosen = null; }
  };
  b.on('tick', sync, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u || unit === chosen) sync(); }, { owner: u });
}
