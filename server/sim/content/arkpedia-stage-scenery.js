// SPDX-License-Identifier: GPL-3.0-or-later
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { sceneryDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { spawnStageObstacle } from './arkpedia-stage-obstacles.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
export class StageScenery {
  constructor(b, devices, geometry = {}) {
    this.b = b;
    this.entries = new Map();
    this.stumps = new Map();
    this.brokenStumps = new Map();
    geometry.tileGrid?.forEach((row, r) => row.forEach((type, c) => {
      if (geometry.tileLegend[type]?.key === 'tile_wooden_wall') this.stumps.set(`${r},${c}`, { row: r, col: c });
    }));
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.scenery) continue;
      const raw = sceneryDefinition(d.key, d.instance), spec = { ...raw, ...stageDeviceAttributes(b.stageCardRules, d.key, raw) };
      if (spec.kind === 'obstacle') {
        if (!spawnStageObstacle(b, d.row, d.col, spec)) throw Error('Occupied Roadblock tile');
        continue;
      }
      const unit = b.spawnDevice(d.key, d.row, d.col, { hp: spec.hp, def: spec.def, res: spec.res, blockCnt: spec.block, name: spec.name });
      if (!unit) throw Error('Occupied Mushroom tile');
      const id = `stage-device:${d.key}:${d.row}:${d.col}`;
      unit.deploymentSlotCost = 0; unit.tags.add('tree'); unit.mem.stageDeviceId = id;
      this.stumps.set(`${d.row},${d.col}`, { row: d.row, col: d.col });
      unit.base.tauntLevel = spec.taunt; unit.markDirty();
      unit.rangeKeys = absoluteRangeKeys(spec.range, d.row, d.col, 'RIGHT');
      const aura = new OwnedStageAura(b, unit, { key: 'stage:mushroom', strength: spec.defense, mods: { defFlat: spec.defense } });
      const update = () => aura.update(unit.alive && unit.deployed ? b.allyUnits.filter(u => u !== unit && u.alive && u.deployed
        && !u.hidden && !u.s.flags.untargetable && !u.s.flags.sleep
        && (u.kind !== 'device' || u.mem.regularSummonCard || u.profile.enemyTargetableDevice) && bodyInKeys(u, unit.rangeKeys)) : []);
      const off = b.on('tick', update); let death;
      death = b.on('death', ({ unit: dead }) => { if (dead === unit) {
        this.entries.get(id).state = 'spent'; aura.clear(); b.off(off); b.off(death);
      } });
      this.entries.set(id, { id, unit, name: spec.name, spec, state: 'active', row: d.row, col: d.col });
    }
  }

  /** Native tile selector: intact mushrooms or their underlying wooden wall.
   * A felled mushroom remains eligible; a broken stump never becomes eligible again. */
  destructibleStumps(source, radius) {
    return [...this.stumps.values()].filter(({ row, col }) => {
      const t = this.b.grid.tile(row, col);
      return !this.brokenStumps.has(`${row},${col}`) && t?.build !== 'NONE' && t?.pass !== 'NONE'
        && Math.hypot(col - source.x, row - source.y) <= radius + 1e-9;
    });
  }

  destroyStump(row, col, source) {
    const key = `${row},${col}`, b = this.b;
    if (!this.stumps.has(key) || this.brokenStumps.has(key)) return false;
    // InstantKill uses the ordinary death/rebirth pipeline, including hosted
    // and overlapping allied bodies. Obstacles belong to another category.
    for (const u of b.allyUnits.slice()) if (u.alive && u.deployed && !u.obstacle
      && u.tileR === row && u.tileC === col) b.kill(u, source);
    b.grid.setTile(row, col, { ...b.grid.tile(row, col), build: 'NONE', pass: 'FLY' });
    this.brokenStumps.set(key, { row, col, height: Math.fround(.4), unitId: 'trap_017_wooden_broke' });
    b.fx('explode', { x: col, y: row, r: .5, kind: 'stump' });
    return true;
  }
}

export {sealsStageRoute} from './arkpedia-stage-route-blocking.js';
