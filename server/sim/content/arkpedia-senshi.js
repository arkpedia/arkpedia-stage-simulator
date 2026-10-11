// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs, ranks, facing chains and dispatch limits are preserved in
// data/arkpedia-senshi-prefabs.json. No generic SP refill or invented food FX.
import evidence from '../../../data/arkpedia-senshi-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_4143_sensi', MARCILLE = 'char_4141_marcil';
const live = u => u?.alive && u.deployed && !u.hidden;
const first = u => u.skill.id === 'skchr_sensi_1';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const recipes = ['atk', 'atk_speed', 'max_hp'];
const recipeKey = n => `sensi_s_1[${n}]`;
const resultKey = n => `sensi_s_1[${n}_attribute]`;
function targets(b, u, ordinaryOnly = false) {
  const keys = new Set(absoluteRangeKeys(evidence.tables.ranges['x-4'].grids.map(g => [g.row, g.col]), u.tileR, u.tileC, u.dir));
  return b.allyUnits.filter(a => live(a) && (!ordinaryOnly || a.kind === 'op') && a.kind !== 'device'
    && !a.s.flags.untargetable && !a.s.flags.healFree && b.allySelectable(a, u)
    && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal)) && bodyInKeys(a, keys));
}
function foodBuff(b, u, a, s, recipe) {
  if (a.kind !== 'op') return; // native IsCharacter, not summon/device stats
  const mods = recipe === 'atk' ? { atkPct: s.bb.atk }
    : recipe === 'atk_speed' ? { aspd: s.bb.attack_speed } : { hpPct: s.bb.max_hp };
  // EXTEND and independentCharacterSource0: repeat food never stacks. A new
  // type clears the other two shared keys; its lifetime outlives the cook.
  b.addBuff(a, { key: resultKey(recipe), source: u, duration: s.bb.up_duration, refresh: 'extend', mods });
  for (const n of recipes) if (n !== recipe) b.removeBuff(a, resultKey(n));
}
function finishMeal(b, u, s, state) {
  const recipients = targets(b, u);
  if (first(u)) {
    // Native postFilter39/selectionTiming1 comparator is not available. Local
    // healing priority is lowest HP ratio, then deployment order, at release.
    const a = recipients.sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq)[0];
    if (!a) return;
    b.heal(u, a, u.s.atk * s.bb.heal_scale);
    foodBuff(b, u, a, s, state.recipe);
  } else for (const a of recipients) {
    b.heal(u, a, u.s.atk * s.bb.heal_scale);
    // Original CheckTargetRootTile binds ModifySp to Marcille alone. Her full
    // kit/Mana controller is not enabled by this adapter. Normal allies gain
    // no SP, including full-HP recipients and the other Delicious in Dungeon units.
    if (a.def.charId === MARCILLE) a.skill?.gainSp(s.bb.magic_sp, 'senshi:mana');
  }
}
function startCooking(b, u, s) {
  const n = first(u) ? 1 : 2, clip = `Skill_${n}`, state = {
    seq: u.deploySeq, activation: u.skill.activations, control: u.attackControlEpoch,
    elapsed: 0, nextPulse: .15, released: false, recipe: null,
    hit: model(u).hits[clip][0] / model(u).durations[clip] * s.duration,
  };
  u.mem.senshiCooking = state;
  u.mem.regularFormVisual = { clip, loop: false };
  if (n === 1) {
    for (const name of recipes) b.removeBuff(u, recipeKey(name));
    state.recipe = b.rng.pick(recipes); // native weights 1/1/1, once at cast start
    b.addBuff(u, { key: recipeKey(state.recipe), source: u, duration: s.duration });
  }
}
function endCooking(u) { u.mem.senshiCooking = null; u.mem.regularFormVisual = null; }
function tickCooking(b, u, s, dt) {
  const state = u.mem.senshiCooking;
  if (!state) return;
  if (!live(u) || !u.canAct || u.deploySeq !== state.seq || u.skill.activations !== state.activation
    || u.attackControlEpoch !== state.control) { u.skill.end('interrupted'); return; }
  state.elapsed += Math.min(dt, Math.max(0, u.skill.timeLeft));
  if (!first(u)) {
    // Native firstTriggerInterval .15, triggerInterval1. The cast clock is
    // fixed-duration, not ordinary ASPD. Periodic HEAL profession mask639.
    while (state.nextPulse <= state.elapsed + 1e-9 && state.nextPulse < s.duration) {
      for (const a of targets(b, u, true)) b.heal(u, a, u.s.atk * s.bb.tick_heal_scale);
      state.nextPulse += 1;
    }
  }
  if (!state.released && state.elapsed + 1e-9 >= state.hit) {
    state.released = true; finishMeal(b, u, s, state);
  }
}
export function customizeSenshiKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    maxTargets: 1, maxTargetsByBlock: false, hits: 1, hitsFn: null, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, splashRadius: 0, heal: null,
    retargetOnRelease: true, interruptOnSkillChange: true, attackVisual: 'Attack',
    windup: () => model(u).hits.Attack[0] / Math.min(1, u.base.bat / u.s.interval) };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    flags: { disarm: true }, attack: { noAttack: true }, trigger: { rule: 'NEVER' },
    onStart: () => startCooking(b, u, s), onTick: ({ dt }) => tickCooking(b, u, s, dt),
    onEnd: () => endCooking(u) };
}
export function installSenshi({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    const talent = def.talents[0]?.bb;
    if (talent) b.addBuff(u, { key: 'sensi_t_1', source: u,
      mods: { defPct: talent.def, healingDealtMul: talent.heal_scale } });
  }, { owner: u });
  // Skill handler explicitly allows no target. Automatic cooking begins when
  // ready even when everyone is healthy, and picks a recipient at its event.
  b.every(b.dt, () => {
    if (first(u) && live(u) && u.canAct && !u.s.flags.silence && u.skill.ready && !u.skill.active)
      u.skill.activate('senshi:auto');
  }, { owner: u });
}
