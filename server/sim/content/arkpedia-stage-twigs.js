// SPDX-License-Identifier: GPL-3.0-or-later
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { addCorruptionField } from './arkpedia-corruption.js';
import { twigsDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { countedLevelProgress } from './arkpedia-enemy-rot-eater.js';

export class StageTwigs {
  constructor(b, entries = []) {
    this.b = b; this.entries = new Map();
    for (const entry of entries) {
      if (!entry.alias || this.entries.has(entry.alias)) throw Error('Ambiguous Twigs alias');
      this.entries.set(entry.alias, { ...entry, activated: false, unit: null });
    }
    for (const e of this.entries.values()) if (!e.hidden) this.activate(e.alias);
  }
  activate(alias) {
    const entry = this.entries.get(alias); if (!entry) return false;
    if (entry.activated) return true;
    const b = this.b, spec = twigsDefinition(entry.instance);
    const stats = stageDeviceAttributes(b.stageCardRules, entry.key, spec);
    entry.unit = b.spawnDevice(entry.key, entry.row, entry.col, { side: 'enemy', name: entry.name,
      hp: stats.hp, def: stats.def, res: stats.res, blockCnt: 0,
      initialize: unit => installTwigs(b, unit, spec, { progress: () => countedLevelProgress(b), animation: spec.animation }) });
    entry.activated = true;
    return true;
  }
}

/** Device lifecycle over an already compiled source definition. The caller
 * supplies original animation clocks and level progress; neither is inferred
 * from a stage name or an unrelated enemy's attack interval. */
export function installTwigs(b, unit, spec, { progress, animation }) {
  if (typeof progress !== 'function' || !Number.isFinite(animation?.release) || animation.release < 0
    || !(animation.duration >= animation.release) || !(spec.radius > 0)
    || !b.stageBranches?.branches[spec.branchId]?.spawns.some(a => a.order === spec.actionIndex))
    throw Error('Twigs requires source clocks, progress and a compiled death branch');
  const state = { dark: false, retired: false, left: spec.interval, sequence: 0, cast: null, timer: null };
  unit.profile.characterLikeDevice = true; unit.profile.holdsBattle = false;
  unit.deploymentSlotCost = 0; unit.base.tauntLevel = spec.taunt;
  unit.def.profession = 'TRAP'; unit.def.immune = new Set(spec.immune); unit.markDirty();
  b.addBuff(unit, { key: 'stage:twigBody', persist: true, flags: { noMove: true } });
  const selected = u => u.side === 'ally' && (u.kind !== 'device' || u.profile.characterLikeDevice)
    && u.alive && u.deployed && !u.hidden && !u.s.flags.untargetable && !u.s.flags.targetFree
    && !u.s.flags.sleep && !u.s.flags.stealth;
  const contains = u => Math.hypot(u.x - unit.x, u.y - unit.y) <= spec.radius + ALLY_COLLIDER_RADIUS + 1e-9;
  const removeField = addCorruptionField(b, unit, { low: spec.pollutionLow, high: spec.pollutionHigh,
    eligible: selected, contains });
  const finishCast = () => { state.cast = null; unit.mem.regularFormVisual = null; };
  b.on('death', c => {
    if (c.unit !== unit || state.retired) return;
    state.retired = true; if (state.timer) state.timer.cancelled = true;
    removeField(); finishCast();
    if (c.reason === 'killed') b.stageBranches.summon(spec.branchId, spec.actionIndex);
  }, { owner: unit });
  const checkProgress = () => {
    if (state.retired || !unit.alive || !unit.deployed) return;
    const ratio = progress();
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw Error('Invalid Twigs level progress');
    if (ratio >= 1) { b.kill(unit); return; }
    // Keep victory pending until the next original progress check can release
    // the managed child. The timer belongs to this device life only.
    state.timer = b.after(Math.fround(.1), checkProgress, { owner: unit, holdsBattle: true });
  };
  state.timer = b.after(Math.fround(.1), checkProgress, { owner: unit, holdsBattle: true });
  b.on('tick', ({ dt }) => {
    if (state.retired || !unit.alive || !unit.deployed) return;
    if (!state.dark && unit.hpRatio < spec.threshold) { state.dark = true; state.left = spec.interval; }
    if (!state.dark) return;
    if (state.cast) {
      const cast = state.cast; cast.elapsed += dt;
      if (!cast.released && cast.elapsed + 1e-9 >= animation.release) {
        cast.released = true;
        for (const target of cast.targets) if (target.deploySeq === cast.lives.get(target) && selected(target))
          b.dealDamage(unit, target, { type: 'element', element: 'apoptosis', amount: spec.element,
            isAttack: true, isSkill: false, ignoreSelect: true, canDodge: false, tags: ['twigNecrosis'] });
      }
      if (cast.elapsed + 1e-9 >= animation.duration) finishCast();
    }
    state.left -= dt;
    if (state.left > 1e-9 || state.cast || !unit.canAct) return;
    state.left = spec.interval;
    const targets = b.allyUnits.filter(u => selected(u) && contains(u));
    state.cast = { elapsed: 0, released: false, targets, lives: new Map(targets.map(t => [t, t.deploySeq])) };
    unit.mem.regularFormVisual = { clip: animation.clip, loop: false, speed: 1, playId: `twig:${++state.sequence}` };
  }, { owner: unit });
  return state;
}
