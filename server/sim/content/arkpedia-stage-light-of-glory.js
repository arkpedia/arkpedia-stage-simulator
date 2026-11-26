// SPDX-License-Identifier: GPL-3.0-or-later
// Light of Glory (trap_164_lrsiege). Reviewed in shared/arkpedia/stage-light-of-glory.js. Hidden until its wave action
// (ACTIVATE_PREDEFINED on its alias) switches it on; then a circle around it grows every 0.03 s (the step starts at
// `step`, gains `stepGain` per tick up to `maxStep`; radius `start` + the summed steps, at most `maxRadius`).
// - Operators inside: ATK +300%, DEF +400%, RES +30%, +300 HP/s (one aura, OwnedStageAura).
// - Enemies inside: Movement Speed -0.1.
// - Every 1 s, Originium pollution inside is cleared: the stage's pollution tiles, and pollution zones whose centre lies
//   inside (the simulator draws a Caustic Originium Slug's pollution as a zone, not as tiles).
// - Any Active Originium Storm it finds (checked every 0.1 s, no range) gets the shrinking core 7 s later: its growth
//   stops, and every 0.03 s its radius shrinks by a step from -0.0082 to -0.012; it dies once radius - 0.0082 < 0.5.
import { lightOfGloryDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';

const CORE = 'trap_lrsiege[eliminate_storm][core]';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const inside = (a, u) => (u.x - a.col) ** 2 + (u.y - a.row) ** 2 <= a.radius ** 2 + 1e-9;

export class StageLightOfGlory {
  constructor(b, devices, geometry, stage = null) {
    this.battle = b; this.entries = new Map();
    const lights = devices.filter(d => stageDeviceSpec(d)?.lightOfGlory);
    if (!lights.length) return;
    for (const d of lights) {
      if (!(d.hidden === true && d.scheduledActivation === true && typeof d.alias === 'string'))
        throw Error('Light of Glory requires its scheduled activation');
      const spec = lightOfGloryDefinition(d.instance);
      // The aura's owner before (or without) a placed body: a plain identity (OwnedStageAura keys buffs by it).
      const owner = { id: `stage-device:${d.key}:${d.row}:${d.col}`, side: 'ally', alive: true };
      this.entries.set(d.alias, { d, spec, row: d.row, col: d.col, active: false, unit: null, step: 0, extend: 0, radius: 0,
        clock: 0, tileClock: 0, cleared: 0, activatedAt: null, stormClock: 0, found: new Map(),
        ally: new OwnedStageAura(b, owner, { key: `stage:lightOfGlory:${d.alias}`, strength: 1, mods: { ...spec.ally } }),
        enemy: new OwnedStageAura(b, owner, { key: `stage:lightOfGlory:enemy:${d.alias}`, strength: 1, mods: { ...spec.enemy } }) });
    }
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  /** ACTIVATE_PREDEFINED on its alias. */
  activate(alias) {
    const a = this.entries.get(alias), b = this.battle;
    if (!a) return false;
    if (a.active) return true;
    a.active = true; a.activatedAt = b.time;
    // trap_lrsiege[ctrl] ON_BUFF_START: the first step.
    a.step = Math.min(a.spec.step, a.spec.maxStep); a.radius = a.spec.start;
    const unit = b.spawnDevice(a.d.key, a.row, a.col, { name: a.d.name, hp: 20000, blockCnt: 0, dir: a.d.instance?.direction });
    if (unit) {
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = `stage-device:${a.d.key}:${a.row}:${a.col}`;
      b.addBuff(unit, { key: 'stage:lightOfGloryBody', persist: true, flags: { invulnerable: true, untargetable: true, disarm: true, noMove: true } });
      a.unit = unit;
    }
    this.sync(a);
    return true;
  }
  tick(dt) {
    for (const a of this.entries.values()) {
      if (!a.active) continue;
      const s = a.spec;
      a.clock += dt;
      while (a.clock + 1e-9 >= s.tick) {
        a.clock -= s.tick;
        a.step = Math.min(a.step + s.stepGain, s.maxStep);
        a.extend = Math.min(a.extend + a.step, s.maxRadius);
      }
      a.radius = Math.min(s.start + a.extend, s.maxRadius);
      this.sync(a);
      a.tileClock += dt;
      while (a.tileClock + 1e-9 >= s.tileEvery) { a.tileClock -= s.tileEvery; this.clear(a); }
      a.stormClock += dt;
      while (a.stormClock + 1e-9 >= s.storm.every) { a.stormClock -= s.storm.every; this.findStorms(a); }
    }
  }
  /** trap_lrsiege[eliminate_storm]: every storm found gets the core `predelay` s later (one per storm). */
  findStorms(a) {
    const b = this.battle, S = a.spec.storm;
    for (const e of b.enemies) {
      if (!e.alive || !e.deployed || !e.mem.storm || !e.findBuff('enemy_bigstorm[passive]') || a.found.has(e)) continue;
      a.found.set(e, b.time);
      b.after(S.predelay, () => { if (e.alive && !e.findBuff(CORE)) this.shrink(e, S); }, { owner: e });
    }
  }
  /** trap_lrsiege[eliminate_storm][core]: the storm's radius (its growth suspended) shrinks every 0.03 s until it dies. */
  shrink(e, S) {
    const b = this.battle, storm = e.mem.storm;
    b.addBuff(e, { key: CORE, persist: true });
    // Ticks on its own 0.03 s clock (several may fall in one battle step).
    const base = storm.r;
    let step = Math.max(S.step, S.maxStep), addon = 0, clock = 0;
    const h = b.on('tick', ({ dt }) => {
      if (!e.alive) return b.off(h);
      clock += dt;
      while (clock + 1e-9 >= S.tick) {
        clock -= S.tick;
        step = Math.max(step + S.stepGain, S.maxStep);
        addon += step;
        if (base + addon - step + S.step < S.floor) { b.kill(e, null); return b.off(h); }
        storm.r = Math.max(0, base + addon);
      }
    });
  }
  sync(a) {
    const b = this.battle;
    a.ally.update(b.allies().filter(u => live(u) && u.def?.profession !== 'TRAP' && inside(a, u)));
    a.enemy.update(b.enemies.filter(u => live(u) && !u.mem.stageDeviceId && inside(a, u)));
  }
  /** trap_lrsiege[switch_tile]: pollution inside the circle is cleared. */
  clear(a) {
    const b = this.battle;
    for (const tile of [...(b.mvpStagePollution ?? [])]) {
      const [row, col] = tile.split(',').map(Number);
      if ((col - a.col) ** 2 + (row - a.row) ** 2 <= a.radius ** 2 + 1e-9) { b.mvpStagePollution.delete(tile); a.cleared++; }
    }
    for (const zone of [...(b._corruptionZones ?? [])])
      if (Number.isFinite(zone.until) && Number.isFinite(zone.x) && (zone.x - a.col) ** 2 + (zone.y - a.row) ** 2 <= a.radius ** 2 + 1e-9) {
        b._corruptionZones.delete(zone); a.cleared++;
      }
    b.fx('zone', { x: a.col, y: a.row, r: a.radius, dur: a.spec.tileEvery, kind: 'lightOfGlory' });
  }
}
