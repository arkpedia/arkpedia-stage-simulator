// SPDX-License-Identifier: GPL-3.0-or-later
import { RADIANT_KNIGHT_OPERATORS } from '../../../shared/arkpedia/radiant-knight-operators.js';
import evidence from '../../../data/arkpedia-radiant-knight-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { COLS } from '../constants.js';

const ID = 'char_1014_nearl2', SUN = 'token_10019_nearl2_sword';
const live = u => u?.alive && u.deployed && !u.hidden;
const kaz = u => u?.kind === 'op' && u.side === 'ally' && u.tags.has('kazimierz');
const model = u => evidence.originalModels[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100;
const s1 = u => u.skill.active && u.skill.id === 'skchr_nearl2_1';
const s3 = u => u.skill.active && u.skill.id === 'skchr_nearl2_3';
const clip = u => s1(u) ? u.dir === 'DOWN' ? 'Skill_1_Loop_Down' : 'Skill_1_Loop'
  : s3(u) ? u.dir === 'DOWN' ? 'Skill_3_Down' : 'Skill_3' : 'Attack_Loop';

/** Original CardBuff excludes tokens/traps. Failed placements, enemy spawns,
 * withdrawals and token births do not replace the previous operator. */
export function installRadiantKnightSquad({ battle: b, records }) {
  if (!records[ID] || b.radiantKnightHistoryInstalled) return;
  b.radiantKnightHistoryInstalled = true;
  b.radiantKnightPreviousOperator = null;
  b.on('deploy', ({ unit }) => {
    if (unit.side !== 'ally' || unit.kind !== 'op') return;
    unit.mem.radiantKnightPreviousKaz = kaz(b.radiantKnightPreviousOperator);
    b.radiantKnightPreviousOperator = unit;
  }, { priority: 1000 });
}

function burst(b, actor, amountSource, bb, doubled) {
  if (!live(actor) || !live(amountSource)) return;
  const keys = absoluteRangeKeys(evidence.ranges['x-5'], actor.tileR, actor.tileC, 'RIGHT');
  // Native WALK damage-purpose selector, including target-free/stealth rules.
  const victims = b.enemiesInKeys(keys, actor, { canHitFly: false });
  for (const e of victims) {
    // The native active combo is a separate mitigated damage event. Its
    // ordering relative to the base spell is explicitly scoped in evidence.
    for (let i = 0; i < (doubled ? 2 : 1) && canTargetEnemy(actor, e, { canHitFly: false }); i++)
      b.dealDamage(actor, e, { amount: amountSource.s.atk * bb.atk_scale,
        type: 'true', applyWay: 'melee', isAttack: true, isSkill: actor === amountSource ? false : true,
        tags: ['radiant-knight:birth'] });
    if (e.alive) b.applyStatus(e, 'stun', { source: actor, duration: bb.stun });
  }
  if (victims.length) b.fx('summon', { x: actor.x, y: actor.y, id: actor.id });
}

function sunRecord(b, u) {
  const source = b.data.raw.tokens[SUN];
  if (!source) throw Error('Missing reviewed Blazing Sun source');
  const build = u.def.raw.arkpedia, phase = source.phases[build.elite];
  const lo = phase.attributesKeyFrames[0], hi = phase.attributesKeyFrames.at(-1);
  const t = (build.level - lo.level) / (hi.level - lo.level || 1);
  const stats = Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + ((hi.data[k] ?? v) - v) * t]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return { id: SUN, name: source.name, profession: source.profession,
    subProfessionId: source.subProfessionId, position: source.position, stats,
    rangeGrid: phase.rangeGrid, talents: [], skill: null, abnormal: ['healFree'],
    avatar: source.avatar, arkpedia: { ...build } };
}
function createSun(b, u) {
  const keys = absoluteRangeKeys(evidence.ranges['x-5'], u.tileR, u.tileC, 'RIGHT');
  const free = keys.filter(key => {
    const r = Math.floor(key / COLS), c = key % COLS;
    return b.grid.inRect(r, c) && ['MELEE', 'ALL'].includes(b.grid.tile(r, c).build)
      && !b.downOn(r, c) && !b.allyUnits.some(a => live(a) && a.tileR === r && a.tileC === c);
  });
  // Literal filter11 preference has no recovered executable binding. Do not
  // guess enemy-priority/facing preference; retain the seeded final choice.
  const key = b.rng.pick(free);
  if (key == null) return;
  const token = b.spawnToken(u, SUN, Math.floor(key / COLS), key % COLS, {
    def: sunRecord(b, u), dir: 'RIGHT',
    kit: { skill: null, trait: { noAttack: true, canAttack: () => false },
      install: (battle, t) => {
        t.deploymentSlotCost = 0;
        battle.addBuff(t, { key: 'radiant-knight:sun-heal-free', persist: true, allowDead: true,
          flags: { healFree: true }, mods: { hpRegenMul: 0, spRecoveryMul: 0 } });
      } },
  });
  if (!token) return;
  u.mem.radiantKnightSun = token;
  const seq = u.deploySeq, activation = u.skill.activations;
  // useRealBornTimeFromAnim1 maps to the exact original Start .333. The
  // eventless hidden spell follows birth; native empty-event dispatch is not
  // certified. Read prior operator and owner ATK at this mapped birth phase.
  b.after(evidence.sunModel.durations.Start, () => {
    if (!live(token) || !token.canAct || !live(u) || !s3(u) || u.deploySeq !== seq
      || u.skill.activations !== activation) return;
    const bb = evidence.tableContracts[SUN].skills.sktok_nearl2_3.levels[u.def.raw.arkpedia.skillRank - 1].blackboard;
    burst(b, token, u, Object.fromEntries(bb.map(row => [row.key, row.value])),
      kaz(b.radiantKnightPreviousOperator));
  }, { owner: token });
}
function removeSun(b, u) {
  const t = u.mem.radiantKnightSun;
  u.mem.radiantKnightSun = null;
  if (live(t)) b.kill(t);
}
function windup(b, u) {
  if (u.mem.regularFormVisual?.clip === 'Attack_End') u.mem.regularFormVisual = null;
  const name = clip(u), opening = !s1(u) && !s3(u) && u.mem.radiantKnightOpening;
  u.mem.radiantKnightOpeningVisual = opening;
  u.mem.radiantKnightOpening = false;
  const begin = opening ? model(u).durations.Attack_Begin / rate(u) : 0;
  u.mem.radiantKnightBeginDuration = begin;
  u.mem.radiantKnightClip = name;
  u.mem.radiantKnightEngaged = true;
  u.mem.radiantKnightAnimationEnd = b.time + begin + model(u).durations[name] / rate(u);
  return begin + model(u).hits[name][0] / rate(u);
}
function attackVisual(_b, u) {
  return u.mem.radiantKnightOpeningVisual ? { begin: 'Attack_Begin', loop: u.mem.radiantKnightClip,
    beginDuration: u.mem.radiantKnightBeginDuration } : u.mem.radiantKnightClip;
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const blocker = target.blockedBy;
  const pure = info.isSkill && u.skill.id === 'skchr_nearl2_3'
    && (blocker === u || live(blocker) && blocker === u.mem.radiantKnightSun);
  resolveHit(b, u, { ...p, dmgType: pure ? 'true' : 'phys' }, target, info, target.x, target.y);
}
export function customizeRadiantKnightKit({ battle: b, id, def, unit: u, kit }) {
  if (!RADIANT_KNIGHT_OPERATORS[id]) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    hits: 1, hitsFn: null, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, splashRadius: 0, chain: null, dmgMul: null,
    retargetOnRelease: true, interruptOnSkillChange: true, windup, attackVisual, launchAttack: launch };
  const s = def.skill, bb = s.bb;
  kit.skill = { id: s.id, name: s.name, kind: s.id === 'skchr_nearl2_1' ? 'toggle' : 'duration',
    duration: s.duration, ...(s.rangeGrid ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
    mods: { atkPct: bb.atk, ...(s.id === 'skchr_nearl2_1' ? { aspd: bb.attack_speed }
      : s.id === 'skchr_nearl2_3' ? { defPct: bb.def } : {}) }, attack: {},
    ...(s.id === 'skchr_nearl2_2' ? { activateOnDeploy: true, spCost: 0, spType: 'none', trigger: 'NEVER' } : {}),
    onStart: () => {
      if (s.id === 'skchr_nearl2_1') {
        const seq = u.deploySeq, activation = u.skill.activations;
        const duration = model(u).durations.Skill_1_Begin;
        u.mem.regularFormVisual = { clip: 'Skill_1_Begin', loop: false };
        b.addBuff(u, { key: 'radiant-knight:s1-begin', source: u, duration, flags: { disarm: true } });
        b.after(duration, () => { if (live(u) && s1(u) && u.deploySeq === seq
          && u.skill.activations === activation) u.mem.regularFormVisual = { clip: 'Skill_1_Idle', loop: true };
        }, { owner: u });
      } else if (s.id === 'skchr_nearl2_2') {
        u.mem.radiantKnightS2Kaz = kaz(b.radiantKnightPreviousOperator);
        b.addBuff(u, { key: 'radiant-knight:s2-shield', source: u, shieldHits: bb.times });
      } else {
        u.mem.regularFormVisual = { clip: 'Skill_3_Idle', loop: true };
        createSun(b, u);
      }
    },
    onEnd: ({ reason }) => {
      removeSun(b, u); u.mem.regularFormVisual = null;
      b.removeBuff(u, 'radiant-knight:s1-begin'); b.removeBuff(u, 'radiant-knight:s2-shield');
      u.mem.radiantKnightOpening = true;
      if (s.id !== 'skchr_nearl2_2' || reason !== 'duration' || !live(u)) return;
      const multiplier = u.mem.radiantKnightS2Kaz ? bb['nearl2_s_2[withdraw][combo].respawn_time'] : bb.respawn_time;
      b.addBuff(u, { key: 'radiant-knight:next-spawn', source: u, mods: { redeployMul: multiplier } });
      // Native operator withdrawal coefficient .5; use the actual paid card.
      b.addDp(u.ownerId, Math.floor((b.bench[ID]?.lastCost ?? u.base.cost) / 2));
      b.retreat(u, { reason: 'retreat', permanent: true });
    } };
}
export function installRadiantKnight({ battle: b, unit: u, def }) {
  if (!RADIANT_KNIGHT_OPERATORS[def.charId]) return;
  u.mem.radiantKnightOpening = true; u.mem.radiantKnightEngaged = false;
  const t1 = def.talents.find(t => t.bb.stun != null)?.bb;
  const t2 = def.talents.find(t => t.bb.def_penetrate != null)?.bb;
  if (t2) b.addBuff(u, { key: 'radiant-knight:penetrate', source: u, persist: true, allowDead: true,
    mods: { defIgnorePct: t2.def_penetrate } });
  b.on('deploy', ({ unit }) => {
    if (unit === u && t1) burst(b, u, u, t1, u.mem.radiantKnightPreviousKaz);
  }, { owner: u });
  b.on('tick', () => {
    if (u.mem.radiantKnightEngaged && !s1(u) && !s3(u) && b.time >= u.mem.radiantKnightAnimationEnd
      && !acquireTargets(b, u, u.profile).length) {
      u.mem.radiantKnightEngaged = false; u.mem.radiantKnightOpening = true;
      u.mem.regularFormVisual = { clip: 'Attack_End', loop: false };
      const seq = u.deploySeq;
      b.after(model(u).durations.Attack_End / rate(u), () => {
        if (u.deploySeq === seq && !u.mem.radiantKnightEngaged) u.mem.regularFormVisual = null;
      }, { owner: u });
    }
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) removeSun(b, u); }, { owner: u });
}
