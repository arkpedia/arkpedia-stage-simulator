// SPDX-License-Identifier: GPL-3.0-or-later
import { electricCoilDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { canTargetEnemy } from '../targeting.js';
import { thornsPolygon, thornsPolygonContains } from './arkpedia-thorns-polygon.js';

/** One controller for preplaced and supplied coils; released beams retain their source. */
export class ElectricCoils {
  constructor(b, devices) {
    this.battle = b; this.entries = new Map(); this.beams = [];
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.electricCoil) continue;
      const spec = electricCoilDefinition(d.instance);
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: 100, blockCnt: 0 });
      if (!unit) throw Error('Occupied Mieszko Coil tile');
      this.add(unit, spec, false);
    }
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  add(unit, spec, supplied = true) {
    const b = this.battle, id = supplied ? `stage-supply:${unit.id}` : `stage-device:trap_019_electric:${unit.tileR}:${unit.tileC}`;
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0;
    if (supplied) { unit.mem.stageSupplyId = id; unit.mem.stageSupplyToken = 'trap_019_electric'; unit.mem.stageSupplyRefund = Math.floor(spec.cost * spec.refundRatio); }
    else unit.mem.stageDeviceId = id;
    unit.tags.add('electric');
    b.addBuff(unit, { key: 'stage:electricCoil', persist: true, flags: { invulnerable: true, noMove: true, disarm: true } });
    const tiles = new Set(spec.range.map(([r, c]) => `${r + unit.tileR},${c + unit.tileC}`));
    unit.rangeKeys = spec.range.map(([r, c]) => [r + unit.tileR, c + unit.tileC])
      .filter(([r, c]) => b.grid.inRect(r, c)).map(([r, c]) => r * b.grid.cols + c);
    const entry = { id, name: unit.def.name, unit, spec, tiles, supplied, elapsed: 0, state: 'active', linked: false };
    this.entries.set(id, entry); return entry;
  }
  tick(dt) {
    const b = this.battle, live = [...this.entries.values()].filter(d => d.unit.alive && d.unit.deployed);
    for (const d of this.entries.values()) {
      if (!d.unit.alive || !d.unit.deployed) { d.state = 'spent'; continue; }
      const nearby = live.filter(t => t !== d && d.tiles.has(`${t.unit.tileR},${t.unit.tileC}`));
      d.linked = nearby.length > 0;
      // The passive periodic buff runs from deployment; activation is a visual aura.
      d.elapsed += dt;
      while (d.elapsed + 1e-9 >= d.spec.interval) {
        d.elapsed -= d.spec.interval;
        // Original selector limits one earlier-created target. Stable deployment order
        // is the local tie policy; compiled selector ordering is not available.
        const targets = nearby.filter(t => t.unit.deploySeq < d.unit.deploySeq)
          .sort((a, z) => a.unit.deploySeq - z.unit.deploySeq).slice(0, d.spec.maxTargets);
        for (const t of targets) {
          this.beams.push({ source: d.unit, target: t.unit, spec: d.spec, remaining: d.spec.beamDuration,
            region: thornsPolygon([d.unit, t.unit], { lineHalfWidth: d.spec.width / 2 }), hit: new Set() });
          b.fx('beam', { x: d.unit.x, y: d.unit.y, tx: t.unit.x, ty: t.unit.y, from: d.unit.id, to: t.unit.id, kind: 'electric', dur: d.spec.beamDuration });
        }
      }
    }
    this.beams = this.beams.filter(beam => {
      if (!beam.target.alive || !beam.target.deployed || beam.remaining <= 1e-9) return false;
      for (const e of b.enemies) {
        if (beam.hit.has(e) || !canTargetEnemy(beam.source, e, { canHitFly: true }) || e.s.flags.camu || e.s.flags.camou
          || !thornsPolygonContains(beam.region, e)) continue;
        beam.hit.add(e);
        b.applyStatus(e, 'sluggish', { duration: beam.spec.slow, source: beam.source });
        b.dealDamage(beam.source, e, { amount: beam.spec.damage, type: 'arts', canDodge: false, isAttack: false, tags: ['dot', 'periodic', 'stage:electric'] });
      }
      beam.remaining -= dt; return true;
    });
  }
}
