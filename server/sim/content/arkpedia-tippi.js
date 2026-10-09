// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-tippi-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { regularVisualHeight } from '../../../shared/arkpedia/regular-form-visual.js';

const ID = 'char_4191_tippi';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const clock = u => Math.min(1, u.base.bat / u.s.interval);
const legal = (u, e, p) => canTargetEnemy(u, e, p) && (!e.s.flags.camou || e.blockedBy);
const flyMode = u => [2, 5].includes(u.mem.tippiMode);
function projectile(b, u, p, e, info) {
  if (!legal(u, e, p)) return;
  return b.addProjectile({ from: u, source: u, target: e, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && legal(u, target, p)) resolveHit(b, u, p, target,
        { ...info, isProjectile: true }, target.x, target.y);
    } });
}
function launch(b, u, p, e, info) {
  projectile(b, u, p, e, info);
  if (u.mem.tippiMode !== 5) return;
  const seq = u.deploySeq, control = u.attackControlEpoch, phase = u.mem.tippiPhase;
  for (const delay of model(u).hits.Skill_2_Loop.slice(1)) b.after(delay / clock(u), () => {
    if (!live(u) || u.deploySeq !== seq || u.attackControlEpoch !== control
      || u.mem.tippiPhase !== phase || u.mem.tippiMode !== 5 || !u.canAct || u.s.flags.disarm) return;
    const target = acquireTargets(b, u, p)[0];
    if (target) projectile(b, u, p, target, info);
  }, { owner: u });
}
function transition(b, u, def, landing = false) {
  const second = def.skill.id.endsWith('_2'), prefix = second ? 'Skill_2' : 'Skill';
  const from = regularVisualHeight(u.mem.regularFormVisual, b.time);
  const phase = u.mem.tippiPhase = (u.mem.tippiPhase ?? 0) + 1, seq = u.deploySeq;
  u.mem.tippiMode = (second ? 4 : 1) + (landing ? 2 : 0);
  u.rangeGrid = def.skill.rangeGrid; b.refreshRange(u);
  if (!landing) {
    b.addBuff(u, { key: 'tippi:flight', flags: { liftoff: true } });
    for (const e of u.blocking.slice()) if (!e.isFlying) b._unblock(e);
  }
  b.addBuff(u, { key: 'tippi:transition', flags: { disarm: true } });
  const clip = `${prefix}_${landing ? 'End' : 'Begin'}`;
  u.mem.regularFormVisual = { clip, loop: false, die: 'Die_2',
    height: { start: b.time, from, to: landing ? 0 : def.skill.bb['attack@height_offset'],
      duration: .833299994468689 } };
  u.atkCd = 0;
  // Numeric native ExecuteBuff callbacks are bounded to transition start and
  // the actual clip's completion, as documented in the source evidence.
  b.after(model(u).durations[clip], () => {
    if (!live(u) || u.deploySeq !== seq || u.mem.tippiPhase !== phase) return;
    b.removeBuff(u, 'tippi:transition'); u.atkCd = 0;
    if (landing) {
      u.mem.tippiMode = 0; b.removeBuff(u, 'tippi:flight');
      u.rangeGrid = def.rangeGrid; b.refreshRange(u); u.mem.regularFormVisual = null;
    } else {
      u.mem.tippiMode = second ? 5 : 2;
      u.mem.regularFormVisual = { clip: `${prefix}_Idle`, loop: true,
        attack: `${prefix}_Loop`, die: 'Die_2', heightOffset: def.skill.bb['attack@height_offset'] };
    }
  }, { owner: u });
}
export function customizeTippiKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    blockFly: true, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0, chain: null, rangeAoe: false,
    allInRange: false, install: null, retargetOnRelease: true, launchAttack: launch,
    attackVisual: (_b, a) => a.mem.tippiMode === 5 ? 'Skill_2_Loop' : flyMode(a) ? 'Skill_Loop' : 'Attack',
    windup: 0 };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER',
    canActivate: () => live(u) && u.mem.tippiMode === 0 && u.canAct && !u.s.flags.silence,
    mods: { atkPct: s.bb.atk },
    onStart: () => transition(b, u, def),
    onEnd: ({ reason }) => { if (reason !== 'death' && live(u)) transition(b, u, def, true); } };
}
function evade(b, u, ctx) {
  ctx.dmg.cancel = true;
  b.fx('dodge', { x: u.x, y: u.y, id: u.id }); b.emit('dodge', ctx);
}
export function installTippi({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const talent = def.talents[0]?.bb;
  let talentTimer;
  function timer() {
    talentTimer?.cancel();
    const epoch = u.mem.tippiTalentEpoch = (u.mem.tippiTalentEpoch ?? 0) + 1;
    const seq = u.deploySeq; u.mem.tippiTalentStacks = 0;
    if (!talent || u.mem.tippiEvade) return;
    talentTimer = b.every(1, (_battle, task) => {
      if (!live(u) || u.deploySeq !== seq || u.mem.tippiTalentEpoch !== epoch) { task.cancel(); return; }
      if (++u.mem.tippiTalentStacks >= talent.stack_time) {
        u.mem.tippiEvade = true; u.mem.tippiTalentStacks = 0; task.cancel();
      }
    }, { owner: u });
  }
  const reset = () => {
    u.mem.tippiMode = 0; u.mem.tippiPhase = (u.mem.tippiPhase ?? 0) + 1;
    u.mem.regularFormVisual = null; u.mem.tippiEvade = false;
    u.rangeGrid = def.rangeGrid; b.refreshRange(u); timer();
  };
  reset();
  b.on('deploy', ({ unit }) => { if (unit === u) reset(); }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    u.mem.tippiPhase++; u.mem.tippiTalentEpoch++; u.mem.tippiEvade = false; talentTimer?.cancel();
  } }, { owner: u });
  // The source's applying-modifier trigger runs before its take-damage evade.
  b.on('hit', ctx => {
    if (ctx.target !== u || ctx.dmg.cancel || !live(u)) return;
    const dodgeable = ['phys', 'arts'].includes(ctx.dmg.type) && ctx.dmg.canDodge;
    if (def.skill.id.endsWith('_2') && u.mem.tippiMode === 0 && u.skill.ready && u.skill.activate('incoming-damage')) {
      if (dodgeable) { evade(b, u, ctx); return; }
    }
    if (talent && u.mem.tippiEvade && dodgeable) {
      u.mem.tippiEvade = false; evade(b, u, ctx); timer();
    }
  }, { owner: u });
  b.on('damaged', ({ target, dmg }) => {
    if (target === u && !dmg.tags?.includes('hpLoss') && live(u)) timer();
  }, { owner: u });
}
