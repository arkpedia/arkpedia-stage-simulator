// SPDX-License-Identifier: GPL-3.0-or-later
import { gramophoneDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const live = u => u?.alive && u.deployed && !u.removed;
const character = u => u.kind !== 'device' || u.profile?.enemyTargetableDevice || u.mem.regularSummonCard;

/** Capture mode intentionally never changes the device's enemy faction. */
export class StageGramophones {
  constructor(b, devices) {
    this.battle = b; this.entries = new Map(); this.marked = new Map();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.gramophone) continue;
      const spec = gramophoneDefinition(d.instance), id = `stage-device:${d.key}:${d.row}:${d.col}`;
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, bat: spec.bat, blockCnt: 0 });
      if (!unit) throw Error(`Occupied Gramophone tile: ${id}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id; unit.tags.add('tower');
      b.changeDeviceSide(unit, 'enemy');
      b.addBuff(unit, { key: 'stage:gramophone', persist: true,
        flags: { invulnerable: true, untargetable: true, noMove: true, noDisplace: true, unblockable: true } });
      unit.rangeKeys = absoluteRangeKeys(spec.range, d.row, d.col, 'RIGHT');
      this.entries.set(id, { id, name: d.name, unit, spec, sp: spec.initSp, control: 'neutral', state: 'active',
        tiles: new Set(unit.rangeKeys), chargeTiles: new Set(absoluteRangeKeys(spec.chargeRange, d.row, d.col, 'RIGHT')),
        chargers: new Map(), poll: 0, healClock: 0, attackClock: 0, cast: null, switching: 0 });
    }
    if (this.entries.size) b.on('tick', ({ dt }) => this.tick(dt));
  }
  modifySp(id, amount) {
    const d = this.entries.get(id);
    if (!d || !live(d.unit) || !Number.isFinite(amount) || d.unit.s.flags.noSp) return 0;
    const before = d.sp; d.sp = Math.max(0, Math.min(d.spec.spCost, before + amount)); return d.sp - before;
  }
  switchMode(d, control) {
    const neutral = d.control === 'neutral';
    d.control = control; d.switching = neutral ? d.spec.captureDuration : d.spec.switchDuration;
    d.cast = null; d.attackClock = 0;
    this.battle.fx('pulse', { x: d.unit.x, y: d.unit.y, kind: 'gramophone' });
  }
  seize(id) {
    const d = this.entries.get(id);
    if (!d || !live(d.unit)) return;
    this.modifySp(id, -d.spec.spCost);
    if (d.control !== 'enemy') this.switchMode(d, 'enemy');
  }
  selectable(d, u, healing) {
    if (!live(u) || u === d.unit || u.hidden || !character(u) || !bodyInKeys(u, d.tiles)) return false;
    const f = u.s.flags;
    // Selection is relative to the permanent enemy faction, including healing.
    if (f.sleep || (u.side === 'ally' ? f.untargetable || f.stealth || f.camou : f.isolated)) return false;
    return !healing || !(f.noHeal || f.healFree || u.profile?.noHeal) && u.hp < u.s.maxHp;
  }
  target(d, healing) {
    const side = healing ? d.control : d.control === 'ally' ? 'enemy' : 'ally';
    const candidates = (side === 'ally' ? this.battle.allyUnits : this.battle.enemies).filter(u => this.selectable(d, u, healing));
    candidates.sort(healing
      ? (a, z) => a.hp / a.s.maxHp - z.hp / z.s.maxHp || a.deploySeq - z.deploySeq
      : (a, z) => z.s.taunt - a.s.taunt || z.s.maxHp - a.s.maxHp || a.deploySeq - z.deploySeq);
    return candidates[0];
  }
  release(d, cast) {
    const b = this.battle, u = cast.target;
    if (!live(u) || u.deploySeq !== cast.life) return;
    if (cast.healing) {
      b.heal(d.unit, u, u.s.maxHp * d.spec.healRatio); return;
    }
    b.addProjectile({ source: d.unit, from: d.unit, target: u, speed: d.spec.speed, maxAge: 10, visual: 'arts',
      data: { stageGramophone: d.id, arkpediaTrackedVisual: true }, onHit: ({ target }) => {
        if (target) b.dealDamage(d.unit, target, { amount: target.s.maxHp * d.spec.damageRatio,
          type: 'arts', isAttack: true, applyWay: 'ranged', tags: ['stage:gramophone'] });
      } });
  }
  tick(dt) {
    const b = this.battle, charging = new Set();
    for (const d of this.entries.values()) {
      if (!live(d.unit)) { d.state = 'spent'; d.cast = null; d.chargers.clear(); continue; }
      const present = new Set();
      for (const u of b.allyUnits) {
        if (!live(u) || u.hidden || !(u.kind === 'op' || u.kind === 'token' || u.mem.regularSummonCard)
          || !bodyInKeys(u, d.chargeTiles)) continue;
        present.add(u);
        charging.add(u);
        let clock = d.chargers.get(u);
        if (!clock || clock.life !== u.deploySeq) d.chargers.set(u, clock = { life: u.deploySeq, elapsed: 0 });
        clock.elapsed += dt;
        while (clock.elapsed + 1e-9 >= 1) { clock.elapsed -= 1; this.modifySp(d.id, 1); }
      }
      for (const u of d.chargers.keys()) if (!present.has(u)) d.chargers.delete(u);
      d.poll += dt;
      if (d.poll + 1e-9 >= d.spec.poll) {
        d.poll %= d.spec.poll;
        const control = d.sp >= d.spec.spCost ? 'ally' : d.sp <= 0 ? 'enemy' : d.control;
        if (control !== d.control) { this.switchMode(d, control); continue; }
      }
      d.healClock += dt; const healDue = d.healClock + 1e-9 >= d.spec.healInterval;
      if (healDue) d.healClock %= d.spec.healInterval;
      if (d.switching > 0) { d.switching = Math.max(0, d.switching - dt); continue; }
      if (d.control === 'neutral') continue;
      d.attackClock = Math.max(0, d.attackClock - dt);
      const flags = d.unit.s.flags;
      if (flags.stun || flags.freeze || flags.sleep || flags.disarm) { d.cast = null; continue; }
      if (healDue) {
        const target = this.target(d, true);
        if (target) d.cast = { target, life: target.deploySeq, elapsed: 0, release: d.spec.release, healing: true };
      }
      if (d.cast) {
        d.cast.elapsed += dt;
        if (d.cast.elapsed + 1e-9 >= d.cast.release) { this.release(d, d.cast); d.cast = null; }
      } else if (d.attackClock <= 1e-9) {
        const target = this.target(d, false);
        if (target) {
          d.attackClock = d.unit.s.interval;
          d.cast = { target, life: target.deploySeq, elapsed: 0, release: d.spec.release * 100 / d.unit.s.aspd, healing: false };
        }
      }
    }
    // Native target markers also drive Matterllurgist priority. Multiple
    // Gramophones share one marker while retaining separate SP clocks.
    for (const u of charging) if (u.findBuff('tower_t_1[charge_range]') !== this.marked.get(u) || !this.marked.has(u))
      this.marked.set(u, b.addBuff(u, { key: 'tower_t_1[charge_range]' }));
    for (const [u, buff] of this.marked) if (!charging.has(u)) {
      if (u.findBuff(buff.key) === buff) b.removeBuff(u, buff);
      this.marked.delete(u);
    }
  }
}
