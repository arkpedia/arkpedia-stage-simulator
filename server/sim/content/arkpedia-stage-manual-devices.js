// SPDX-License-Identifier: GPL-3.0-or-later
import { manualDeviceDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { canSpendDp, spendDp } from './arkpedia-dp-budget.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { canTargetEnemy, characterLikeTarget } from '../targeting.js';
import { recordStageOutcome } from './arkpedia-stage-outcomes.js';

export class ManualStageDevices {
  constructor(b, devices) {
    this.battle = b; this.entries = new Map();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.manual) continue;
      const spec = manualDeviceDefinition(d.key, d.instance), id = `stage-device:${d.key}:${d.row}:${d.col}`;
      spec.spCost *= b.stageCardRules?.deviceSkillCost?.[d.key] ?? 1;
      const stats = stageDeviceAttributes(b.stageCardRules, d.key, { hp: 100, atk: spec.damage ?? 0, block: 0, ...spec.stats }, spec.position);
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, ...stats, blockCnt: stats.block,
        ...(spec.direction ? { dir: spec.direction } : {}) });
      if (!unit) throw Error(`Manual device tile is occupied: ${id}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0;
      unit.mem.stageManualDevice = id;
      const terminal = spec.kind === 'terminal', prison = spec.kind === 'prison';
      if (terminal || prison) {
        unit.profile.enemyTargetableDevice = true;
        unit.tags.add(prison ? 'prison' : 'building');
        unit.base.tauntLevel = spec.taunt;
      }
      if (prison) {
        unit.profile.characterLikeDevice = true;
        unit.base.spRecovery = stats.spRecovery;
        unit.def.immune = new Set(spec.immune);
        recordStageOutcome(b, unit, 'born');
      }
      b.addBuff(unit, { key: 'stage:manualDevice', persist: true,
        flags: { ...(terminal || prison ? { isolated: true, healFree: true, noHeal: true } : { invulnerable: true }), disarm: true, noMove: true } });
      const range = spec.range.map(([r, c]) => [d.row + r, d.col + c]);
      unit.rangeKeys = range.filter(([r, c]) => b.grid.inRect(r, c)).map(([r, c]) => r * b.grid.cols + c);
      const tile = stageDeviceSpec(d).dynamicTile, originalTile = tile ? b.grid.tile(d.row, d.col) : null;
      if (tile) b.grid.setTile(d.row, d.col, { ...originalTile, ...tile });
      this.entries.set(id, { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, spec,
        originalTile, tiles: new Set(range.map(([r, c]) => `${r},${c}`)), sp: spec.initSp, state: 'charging', activeAt: null, released: false, affected: new Set() });
    }
    if (this.entries.size) {
      b.on('tick', ({ dt }) => this.tick(dt));
      b.on('death', ({ unit, reason }) => {
        const d = this.entries.get(unit.mem?.stageManualDevice);
        if (!d || d.finished) return;
        d.finished = true; d.state = 'spent'; this.reveal(d, false);
        if (d.originalTile) b.grid.setTile(d.row, d.col, d.originalTile);
        if (d.spec.lifeDelta) b.life += d.spec.lifeDelta;
        if (d.spec.kind === 'prison' && reason === 'killed') recordStageOutcome(b, unit, 'killed');
      });
    }
  }
  error(id) {
    const d = this.entries.get(id), b = this.battle;
    if (!d || !d.unit.alive || d.state === 'spent') return 'This device is no longer available.';
    if (b.finished) return 'The battle has ended.';
    if (d.state === 'active') return 'This device is already active.';
    if (d.spec.kind === 'prison' && !d.unit.canAct) return 'This device cannot act right now.';
    if (d.sp + 1e-9 < d.spec.spCost) return 'The device is charging.';
    if (!canSpendDp(b, 'arkpedia', d.spec.dpCost)) return 'Not enough DP.';
    if (d.spec.kind === 'prison' && !this.prisonTargets(d).length) return 'No eligible enemy is in range.';
    return null;
  }
  activate(id) {
    const error = this.error(id); if (error) throw Error(error);
    const d = this.entries.get(id), b = this.battle;
    spendDp(b, 'arkpedia', d.spec.dpCost);
    d.sp = 0; d.state = 'active'; d.activeAt = b.time; d.released = false;
    if (d.spec.kind === 'reveal') this.reveal(d, true);
    if (d.spec.kind === 'terminal') {
      // Native farm_s_1 grants once on buff start; there is no finish reversal.
      b.unitLimit += d.spec.slots;
      b.addBuff(d.unit, { key: 'stage:terminalUpgrade', mods: d.spec.mods });
    }
    if (d.spec.kind === 'prison') {
      for (const e of this.prisonTargets(d)) {
        b.applyStatus(e, 'stun', { duration: d.spec.stun, source: d.unit });
        for (const a of e.mem.ab?.list ?? []) if (a.free && a.confine) {
          a.confine(b, e, a); if (!a.free) recordStageOutcome(b, e, 'prison');
        }
      }
    }
    b.fx('pulse', { x: d.col, y: d.row, id: d.unit.id, kind: d.spec.kind });
  }
  inside(d, e) { return e.alive && e.deployed && !e.hidden && !e.removed && d.tiles.has(`${Math.round(e.y)},${Math.round(e.x)}`); }
  prisonTargets(d) {
    return this.battle.enemies.filter(e => this.inside(d, e) && characterLikeTarget(e)
      && canTargetEnemy(d.unit, e, { canHitFly: true, hitSleep: true }));
  }
  reveal(d, active) {
    const b = this.battle, key = `stage:detector:${d.id}`, next = new Set();
    if (active) for (const e of b.enemies) if (this.inside(d, e)) {
      next.add(e); if (!e.findBuff(key)) b.addBuff(e, { key, source: d.unit, flags: { reveal: true } });
    }
    for (const e of d.affected) if (!next.has(e)) b.removeBuff(e, key);
    d.affected = next;
  }
  tick(dt) {
    const b = this.battle;
    for (const d of this.entries.values()) {
      if (!d.unit.alive) { this.reveal(d, false); d.state = 'spent'; continue; }
      if (d.state !== 'active') {
        const rate = d.spec.kind === 'prison' ? d.unit.s.flags.noSp ? 0 : d.unit.s.spRecovery : 1;
        d.sp = Math.min(d.spec.spCost, d.sp + dt * d.spec.spPerSecond * rate);
        if (d.sp + 1e-9 >= d.spec.spCost) d.sp = d.spec.spCost;
        d.state = d.sp + 1e-9 >= d.spec.spCost ? 'ready' : 'charging'; continue;
      }
      // tick hooks run at the current step's start timestamp after movement;
      // this update accounts for the interval that ends at time + dt.
      const elapsed = b.time + dt - d.activeAt;
      if (d.spec.kind === 'reveal') {
        const active = elapsed + 1e-9 < d.spec.duration;
        this.reveal(d, active); if (!active) d.state = 'charging';
      } else if (d.spec.kind === 'prison') {
        if (elapsed + 1e-9 >= d.spec.finish) d.state = 'charging';
      } else if (d.spec.kind === 'blast') {
        if (!d.released && elapsed + 1e-9 >= d.spec.release) {
          d.released = true;
          for (const e of b.enemies) if (this.inside(d, e) && !e.isFlying) {
            b.dealDamage(d.unit, e, { amount: d.unit.s.atk, type: 'arts', isAttack: true, applyWay: 'melee', ignoreSelect: true, tags: ['stage:emp'] });
            if (e.alive) b.applyStatus(e, 'stun', { duration: d.spec.stun, source: d.unit });
          }
          b.fx('explode', { x: d.col, y: d.row, r: 1.5, kind: 'arts' });
        }
        if (elapsed + 1e-9 >= d.spec.finish) { d.state = 'spent'; b._remove(d.unit, 'withdraw', null, true); }
      }
    }
  }
}
