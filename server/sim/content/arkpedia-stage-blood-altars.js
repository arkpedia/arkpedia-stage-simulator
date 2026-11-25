// SPDX-License-Identifier: GPL-3.0-or-later
// Bloodcalling Altar (trap_125_bonore). Reviewed in shared/arkpedia/stage-blood-altar.js. An enemy-side trap that no
// selector takes; every 20 s its pulse (3 tiles across, 1 along) travels along its facing and, on its first contact with Blood Amber, turns
// every Blood Amber in the pulse (up to 10) into a Bloodborn Spawn through the Altar's own branch. A Blood Collector
// in the pulse gives up the Amber it holds (its `enemy_bonore_mark` count, e.mem.bonoreMarks): one Spawn each, and it
// survives empty. A drifting Boneguard Fluxcaster in the pulse revives (no Spawn). `covers` is the Altar's range,
// read by the Fluxcaster's rebirth.
import { bloodAltarDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { BLOOD_AMBER, BLOOD_ALTAR_UNMODELLED } from '../../../shared/arkpedia/stage-blood-altar.js';
import { dirVec } from '../dir.js';

const MAX_STACK = 10; // trap_bonore_branch[dfello] maxStackCnt
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const isAmber = e => e.defId === BLOOD_AMBER || e.def?.key === BLOOD_AMBER;
const isGhost = e => !!e.mem?.boneguardGhost;

export class StageBloodAltars {
  constructor(b, devices, geometry, stage = null) {
    this.battle = b; this.entries = [];
    const altars = devices.filter(d => stageDeviceSpec(d)?.bloodAltar);
    const unmodelled = Object.keys(stage?.enemies ?? {}).filter(k => BLOOD_ALTAR_UNMODELLED.includes(k));
    if (altars.length && unmodelled.length) throw Error(`Bloodcalling Altar reactions not modelled: ${unmodelled.join(', ')}`);
    for (const d of altars) {
      if (d.hidden) throw Error('Hidden Bloodcalling Altar requires an activation controller');
      const spec = bloodAltarDefinition(d.instance);
      if (!b.stageBranches?.branches[spec.branchId]) throw Error(`Missing Bloodcalling Altar branch program: ${spec.branchId}`);
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, def: spec.def, res: spec.res, blockCnt: 0, dir: spec.direction });
      if (!unit) throw Error(`Occupied Bloodcalling Altar tile: ${d.row},${d.col}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = `stage-device:${d.key}:${d.row}:${d.col}`;
      b.changeDeviceSide(unit, 'enemy');
      // Trap category: no character selector takes it, so nothing attacks it.
      b.addBuff(unit, { key: 'stage:bloodAltar', persist: true,
        flags: { invulnerable: true, untargetable: true, noMove: true, noDisplace: true, disarm: true, unblockable: true } });
      this.entries.push({ unit, spec, row: d.row, col: d.col, sp: spec.initSp, pulse: null, pulses: 0, conversions: 0 });
    }
    if (this.entries.length) b.on('tick', ({ dt }) => this.tick(dt));
  }
  /** The unit's `enemy_bonore_mark` count: Blood Amber carries one; a Collector one per held Amber; a drifting
   * Boneguard one while an Altar covers it (SpnwizInRange2), or always for the Captain. */
  marks(e) {
    if (isAmber(e)) return 1;
    if (isGhost(e)) return e.mem.boneguardOwnMark || this.covers(e) ? 1 : 0;
    return Math.max(0, e.mem?.bonoreMarks ?? 0);
  }
  /** SpnwizInRange / SpnwizInRange2: a live Altar whose range holds the unit's tile — the Altar's line and one line
   * either side (`_offset` 1), from the Altar's own tile line onward along its facing (`_includeSameLine`). */
  covers(e) {
    const r = Math.round(e.y), c = Math.round(e.x);
    return this.entries.some(a => {
      if (!a.unit.alive || a.destroyed) return false;
      const [dr, dc] = dirVec(a.spec.direction), along = (r - a.row) * dr + (c - a.col) * dc, across = (r - a.row) * dc - (c - a.col) * dr;
      return along >= 0 && Math.abs(across) <= a.spec.rangeOffset;
    });
  }
  tick(dt) {
    for (const a of this.entries) {
      if (!a.unit.alive) { a.pulse = null; continue; }
      if (a.pulse) this.advance(a, dt);
      a.sp = Math.min(a.spec.spCost, a.sp + a.spec.spPerSecond * dt);
      if (a.sp + 1e-9 >= a.spec.spCost && !a.pulse) {
        a.sp = 0; a.pulses++;
        const [dr, dc] = dirVec(a.spec.direction);
        a.pulse = { dr, dc, age: 0, nextCheck: 0 };
        this.advance(a, 0);
      }
    }
  }
  /** Move the pulse and check its box every `interval` s along the way; one hit ends it. */
  advance(a, dt) {
    const p = a.pulse, s = a.spec, b = this.battle, end = Math.min(p.age + dt, s.lifetime);
    while (p.nextCheck <= end + 1e-9) {
      const along = s.speed * p.nextCheck, cx = a.col + p.dc * along, cy = a.row + p.dr * along;
      if (cx < -2 || cy < -2 || cx > b.regularMapSize.cols + 1 || cy > b.regularMapSize.rows + 1) { a.pulse = null; return; }
      const hits = b.enemies.filter(e => live(e) && this.marks(e) > 0 && inBox(e, cx, cy, p, s))
        .sort((x, y) => (x.x - a.col) ** 2 + (x.y - a.row) ** 2 - ((y.x - a.col) ** 2 + (y.y - a.row) ** 2) || String(x.id).localeCompare(String(y.id)))
        .slice(0, s.maxTargets);
      if (hits.length) { this.convert(a, hits); a.pulse = null; return; }
      p.nextCheck += s.interval;
    }
    p.age = end;
    if (p.age + 1e-9 >= s.lifetime) a.pulse = null;
  }
  /** The bomb's Explosion (trap_bonore_kill[bmbcar] -> ActiveOutset): the Altar dies and pulses no more. Its
   * ActivePredifinedInst names no alias on any reviewed stage, so it activates nothing. */
  destroy(a) {
    if (!a?.unit.alive) return;
    a.pulse = null; a.destroyed = true;
    this.battle.removeBuff(a.unit, 'stage:bloodAltar');
    this.battle.kill(a.unit, null);
  }
  convert(a, hits) {
    const b = this.battle;
    for (const e of hits) {
      // trap_bonore_s: its mark count → that many branch phases (CreateBuffStacked, at most 10); the marks finish.
      // Amber's mark end kills it (enemy_dseed_bonore[action]); a Collector's only empties it.
      // A drifting Boneguard (enemy_spnwiz_ghost_mark) takes the other branch: trap_bonore_spnwiz_revive[trigger]
      // finishes its ghost mark, which revives it (enemy-boneguard runtime), and its mark finishes; no phase runs.
      if (isGhost(e)) { e.mem.boneguardRevive = true; continue; }
      const n = Math.min(MAX_STACK, this.marks(e));
      if (isAmber(e)) b.kill(e, null); else e.mem.bonoreMarks = 0;
      for (let i = 0; i < n; i++) {
        b.stageBranches.startRandomPhase(a.spec.branchId, { blockGameFinish: false });
        a.conversions++;
      }
    }
  }
}

function inBox(e, cx, cy, p, s) {
  const dx = e.x - cx, dy = e.y - cy;
  const along = dx * p.dc + dy * p.dr, across = dx * -p.dr + dy * p.dc;
  return Math.abs(along) <= s.length / 2 + 1e-9 && Math.abs(across) <= s.width / 2 + 1e-9;
}
