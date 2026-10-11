// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed owner-finish output. Birth at owner finish and transport of the
// ability's buffs into the projectile action controller are explicit local
// choices, not recovered compiled Unity event/attachment execution.
import evidence from '../../../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import { ELA_ID, selectedElaMine, applyElaMineEffects } from './arkpedia-ela-mines.js';

export const ELA_FINISH_POLICY = 'projectile-stop-from-owner-finish-v1';
const component = (rows, predicate) => rows.flatMap(o => o.components).find(c => predicate(c.data));
const names = index => index === 0 ? ['sluggish', 'ela_token_influence']
  : index === 1 ? ['stun', 'ela_token_influence'] : ['sluggish', 'weak[limit]', 'ela_token_influence'];
const sorted = values => [...values].sort().join('|');

/** Retain the actual projectile/ability fields; do not substitute the owner
 * Die event for the projectile's hit-on-stop boundary. Source movement delay
 * is inside the selected lifetime in this local policy, not added to it. */
export function selectedElaFinishPath(record, kind) {
  if (!['dead', 'withdraw'].includes(kind) || ![0, 1, 2].includes(record?.index))
    throw Error('Invalid Ela finish path');
  const n = record.index + 1, key = `projectile_chr_ela_${kind}_s${n}`;
  const rows = evidence.projectiles[key], skill = evidence.skills[`skchr_ela_${n}`];
  const root = component(rows, c => '_lifeTime' in c), mover = component(rows, c => '_immediatelyReach' in c);
  const selector = component(rows, c => '_targetOptions' in c);
  const ability = component(skill, c => c._metadata?.namedAsAlias === (kind === 'dead' ? 'DeadBoom' : 'WithdrawBoom'));
  const emitter = component(skill, c => c._projectileKey === key);
  const r = root?.data, m = mover?.data, s = selector?.data, a = ability?.data, em = emitter?.data;
  const action = r?._actionController;
  if (!r || !m || !s || !a || !em || r._stopWhenSourceInvalid !== 0 || r._managedBySource !== 0
    || !Number.isFinite(r._lifeTime) || r._lifeTime <= 0
    || m._immediatelyReach !== 1 || m._followTarget !== 0 || m._stopIfTargetDead !== 0
    || m._stopIfTargetDisappeared !== 0 || m._delayToStart < 0 || m._delayToStart > r._lifeTime
    || s._onlyCheckHitWhenStop !== 1 || s._onlyCheckHitWhenReachTarget !== 0
    || s._ignoreCamouflage !== 1 || s._targetOptions.targetSide !== 2
    || s._targetOptions.targetMotion !== 1 || s._targetOptions.ignoreTargetFree !== 0
    || action?._dontAddBuffs !== 0 || action?._onlyAddBuffsToTraceTarget !== 0
    || action?._detachAllBuffsWhenStopped !== 0 || action?._useSelfBlackboard !== 0
    || action?._extraBuffsInTheEnd.length !== 0 || em._includeDeadTargets !== 1
    || em._manageProjectileByOwner !== 0 || a._ignoreIfOwnerDead !== 0 || a._waitForAttackEvent !== 1
    || sorted(a._buffs.map(b => b.buffKey)) !== sorted(names(record.index))
    || record.skill.bb.projectile_range !== 1.7)
    throw Error('Unreviewed Ela owner-finish projectile/ability source');
  return Object.freeze({ kind, key, lifetime: r._lifeTime, movementDelay: m._delayToStart,
    radius: record.skill.bb.projectile_range, rootPathId: root.pathId, moverPathId: mover.pathId,
    selectorPathId: selector.pathId, abilityPathId: ability.pathId, emitterPathId: emitter.pathId });
}

export class ElaOwnerFinish {
  constructor(b, u, build, { policy, reviewNote } = {}) {
    if (u.def.charId !== ELA_ID) throw Error('Ela finish requires the Ela owner');
    if (policy !== ELA_FINISH_POLICY || typeof reviewNote !== 'string' || !reviewNote.trim())
      throw Error('Ela finish requires a reviewed projectile-stop policy');
    this.b = b; this.u = u; this.record = selectedElaMine(build);
    this.paths = { dead: selectedElaFinishPath(this.record, 'dead'), withdraw: selectedElaFinishPath(this.record, 'withdraw') };
    this.handles = []; this.state = null; this.closed = false;
  }
  install() {
    if (this.closed || this.handles.length) return;
    this.handles = [this.b.on('death', ({ unit, reason }) => {
      if (unit === this.u) this.begin(reason === 'killed' ? 'dead' : 'withdraw');
    }, { owner: this.u }),
    // This hook deliberately survives removal of the old owner while its
    // unmanaged born burst is pending. It is removed after output/cancellation.
    this.b.on('battleEnd', () => this.dispose())];
  }
  begin(kind) {
    if (this.closed || this.state || this.b.finished || this.u.deployed || this.u.alive
      || !Number.isInteger(this.u.deploySeq) || this.u.deploySeq <= 0) return false;
    const path = this.paths[kind];
    if (!path) throw Error('Invalid Ela owner-finish reason');
    const state = { source: this.u, seq: this.u.deploySeq, kind,
      point: { x: this.u.x, y: this.u.y }, bornAt: this.b.time, path,
      readyAt: this.b.time + path.lifetime, emitted: false, cancelled: false };
    this.state = state;
    // Once per old deployment. Killing an owner emits only DeadBoom; the
    // following finish cannot also emit WithdrawBoom (native Boomed guard).
    this.timer = this.b.after(path.lifetime, () => {
      if (this.closed || this.b.finished || this.state !== state) return;
      const targets = applyElaMineEffects(this.b, state.source, this.record, state.point.x, state.point.y);
      state.emitted = true;
      this.b.emit('elaFinish', { ...state, targets, skillId: this.record.skill.skillId });
      this.dispose();
    });
    return true;
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    if (this.state && !this.state.emitted) this.state.cancelled = true;
    this.timer?.cancel();
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}
