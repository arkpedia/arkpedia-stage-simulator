// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs, all ranks and original animation events are retained in the
// evidence file. Accepted HP-output dispatch is a bounded engine bridge;
// neither native C# callback ordering nor Unity particle parity is claimed.
import evidence from '../../../data/arkpedia-virtuosa-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { burstLocked } from '../damage.js';
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_245_cello', REFRESH = .30000001192092896;
const live = u => u?.alive && u.deployed && !u.hidden;
const num = u => Number(u.skill.id.at(-1));
const mode = u => u.skill.active && num(u) > 1 ? num(u) : 0;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const speed = u => Math.min(1, u.s.aspd / 100);
const keys = u => absoluteRangeKeys(evidence.tables.ranges[mode(u) === 3 ? 'y-8' : 'y-2']
  .grids.map(p => [p.row, p.col]), u.tileR, u.tileC, u.dir, u.s.rangeExtend || 0);
const plain = { canHitFly: true, dmgType: 'arts', attack: 'ranged' };
const enemies = (b, u) => b.enemiesInKeys(keys(u), u, plain);
const allies = (b, u) => b.allyUnits.filter(a => a !== u && live(a)
  && !['TOKEN', 'TRAP'].includes(a.def.profession) && a.kind !== 'device'
  && !a.s.flags.untargetable && !a.s.flags.isolated && bodyInKeys(a, keys(u)));
const key = (u, stat) => `virtuosa:${stat}:${u.id}`;
const talent = (u, name) => u.def.talents.find(t => t.bb[name] != null)?.bb;
function injury(b, u, e, ratio, tag, attackId) {
  if (!live(e)) return;
  b.dealDamage(u, e, { amount: u.s.atk * ratio, type: 'element', element: 'apoptosis',
    canDodge: false, isAttack: false, isSkill: tag !== 'talent', attackId,
    tags: [`virtuosa:${tag}`] });
}
function launch(b, u, p, e, info) {
  const s1 = info.isSkill && num(u) === 1;
  b.addProjectile({ from: u, source: u, target: e, speed: 10, maxAge: 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (!target || !canTargetEnemy(u, target, p)) return;
      let seen = false, hook;
      if (s1) hook = b.on('damaged', ctx => {
        if (seen || ctx.source !== u || ctx.target !== target || ctx.type !== 'arts'
          || ctx.dmg?.attackId !== info.attackId || !ctx.dmg.tags.includes('virtuosa:primary')) return;
        seen = true;
        if (!burstLocked(target)) injury(b, u, target, u.def.skill.bb.ep_damage_ratio, 's1', info.attackId);
      });
      try { resolveHit(b, u, { ...p, hits: 1, tags: ['virtuosa:primary'] }, target, info, target.x, target.y); }
      finally { if (hook) b.off(hook); }
    } });
}
function clearGrants(b, u) {
  for (const a of b.allyUnits) for (const stat of ['hp', 'atk', 'def']) b.removeBuff(a, key(u, stat));
  u.mem.virtuosaLinked = null;
}
function selectGrants(b, u) {
  // The source finishes derived buffs BEFORE independently selecting each
  // highest attribute. Previous grants must not bias the next sample.
  clearGrants(b, u);
  if (!live(u) || !mode(u)) return;
  const candidates = allies(b, u);
  const highest = stat => candidates.slice().sort((a, z) => z.s[stat] - a.s[stat]
    || a.deploySeq - z.deploySeq)[0];
  if (mode(u) === 2) { u.mem.virtuosaLinked = highest('atk') ?? null; return; }
  for (const [stat, attr, mod] of [['hp', 'maxHp', 'hpPct'], ['atk', 'atk', 'atkPct'], ['def', 'def', 'defPct']]) {
    const a = highest(attr);
    if (a) b.addBuff(a, { key: key(u, stat), source: u,
      mods: { [mod]: u.skill.bb[`cello_s_3[${stat === 'hp' ? 'max_hp' : stat}].${stat === 'hp' ? 'max_hp' : stat}`] } });
  }
}
function begin(b, u) {
  u.mem.virtuosaRefresh = b.time + REFRESH;
  u.mem.virtuosaMembers = new Set(allies(b, u)); selectGrants(b, u);
  const n = num(u), seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: `Skill_${n}_Begin`, loop: false };
  b.after(model(u).durations[`Skill_${n}_Begin`], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: n === 3 ? 'Skill_3_Loop' : 'Skill_2_Idle', loop: true };
  }, { owner: u });
}
function end(b, u) {
  clearGrants(b, u); u.mem.virtuosaMembers = null;
  if (!live(u)) { u.mem.regularFormVisual = null; return; }
  const n = num(u), seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: `Skill_${n}_End`, loop: false };
  b.after(model(u).durations[`Skill_${n}_End`], () => {
    if (u.deploySeq === seq && u.skill.activations === activation && !u.skill.active) u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeVirtuosaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', heal: null,
    canHitFly: true, maxTargets: 1, hits: 1, attackVisual: 'Attack', install: null,
    interruptOnSkillChange: true, retargetOnRelease: false, launchAttack: launch,
    windup: (_b, a) => model(a).hits.Attack[0] / speed(a) };
  const s = def.skill;
  if (s.id.endsWith('_1')) {
    const targets = () => sortEnemyTargets(b, u, enemies(b, u).filter(e => !burstLocked(e)), null).slice(0, 1);
    kit.trait.acquireTargets = targets;
    kit.trait.canAttack = () => !u.s.flags.silence && (u.skill.pending
      || u.skill.ready && u.skill.rule === 'DEFAULT' && u.skill.castEligible);
    kit.skill = { id: s.id, name: s.name, kind: 'charges', charges: s.maxCharges,
      canActivate: () => targets().length > 0,
      onStart: () => {
        const epoch = u.attackControlEpoch;
        b.addBuff(u, { key: 'virtuosa:s1-cast', duration: model(u).durations.Skill_1 / speed(u), flags: { noSp: true } });
        const watch = b.every(b.dt, () => {
          if (!live(u) || !u.canAct || u.attackControlEpoch !== epoch || !u.findBuff('virtuosa:s1-cast')) {
            b.removeBuff(u, 'virtuosa:s1-cast'); watch.cancel();
          }
        }, { owner: u });
      },
      attack: { atkScale: s.bb.atk_scale, attackVisual: 'Skill_1',
        windup: (_b, a) => model(a).hits.Skill_1[0] / speed(a) },
    };
  } else kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: s.id.endsWith('_2') ? { aspd: s.bb.attack_speed } : { atkPct: s.bb.atk },
    ...(s.id.endsWith('_2') ? { attack: { maxTargets: 2, attackVisual: 'Skill_2_Attack',
      windup: (_b, a) => model(a).hits.Skill_2_Attack[0] / speed(a) } }
      : { attack: { noAttack: true }, targeting: { rangeGrid: evidence.tables.ranges['y-8'].grids.map(p => [p.row, p.col]) } }),
    onStart: () => begin(b, u), onEnd: () => end(b, u),
  };
}
export function installVirtuosa({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t1 = talent(u, 'ep_damage_ratio'), t2 = talent(u, 'ep_damage_scale');
  b.on('deploy', ({ unit }) => {
    if (unit === u) u.mem.virtuosaNextPulse = b.time + .8999999761581421;
  }, { owner: u });
  b.on('tick', () => {
    if (!live(u)) return;
    if (t1 && b.time + 1e-9 >= u.mem.virtuosaNextPulse) {
      u.mem.virtuosaNextPulse += 1;
      for (const e of enemies(b, u)) {
        injury(b, u, e, t1.ep_damage_ratio, 'talent');
        if (t1.sluggish > 0 && live(e)) b.applyStatus(e, 'sluggish', { duration: t1.sluggish, source: u });
      }
    }
    if (!mode(u)) return;
    const members = new Set(allies(b, u)), old = u.mem.virtuosaMembers;
    if (!old || members.size !== old.size || [...members].some(a => !old.has(a))
      || b.time + 1e-9 >= u.mem.virtuosaRefresh) {
      u.mem.virtuosaMembers = members;
      if (b.time + 1e-9 >= u.mem.virtuosaRefresh) u.mem.virtuosaRefresh += REFRESH;
      selectGrants(b, u);
    }
  }, { owner: u });
  b.on('elementHit', ({ target, dmg }) => {
    if (!t2 || !live(u) || dmg.cancel || dmg.element !== 'apoptosis' || target.side !== 'enemy'
      || !bodyInKeys(target, keys(u)) || !canTargetEnemy(u, target, plain)) return;
    const factor = mode(u) === 3 ? 1 + (t2.ep_damage_scale - 1) * u.skill.bb.scale_delta_to_one : t2.ep_damage_scale;
    // Native EpDamageScale is nonstacking: retain only the strongest source.
    const previous = dmg.virtuosaScale ?? 1;
    if (factor > previous) { dmg.mul *= factor / previous; dmg.virtuosaScale = factor; }
  }, { owner: u });
  b.on('damaged', ({ source, target, dmg, type }) => {
    if (!live(u) || mode(u) !== 2 || !source || (source !== u && source !== u.mem.virtuosaLinked)
      || !live(source) || target.side !== 'enemy' || !live(target) || !dmg || dmg.cancel || dmg.sourceless
      || !['phys', 'arts', 'true', 'elemental'].includes(type) || dmg.tags.includes('hpLoss')) return;
    // BUFF_SOURCE is Virtuosa even on the linked ally, not that ally's ATK.
    // Injury itself is excluded, avoiding recursive ON_OUTPUT_DAMAGE dispatch.
    injury(b, u, target, def.skill.bb.ep_damage_ratio, 's2', dmg.attackId);
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) clearGrants(b, u); }, { owner: u });
}
