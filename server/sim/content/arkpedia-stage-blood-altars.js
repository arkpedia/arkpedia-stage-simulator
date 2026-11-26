// SPDX-License-Identifier: GPL-3.0-or-later
// Bloodcalling Altar (trap_125_bonore). Reviewed in shared/arkpedia/stage-blood-altar.js. An enemy-side trap that no
// selector takes; every 20 s its pulse (3 tiles across, 1 along) travels along its facing and, on its first contact with Blood Amber, turns
// every Blood Amber in the pulse (up to 10) into a Bloodborn Spawn through the Altar's own branch. A Blood Collector
// in the pulse gives up the Amber it holds (its `enemy_bonore_mark` count, e.mem.bonoreMarks): one Spawn each, and it
// survives empty. A drifting Boneguard Fluxcaster in the pulse revives (no Spawn). `covers` is the Altar's range,
// read by the Fluxcaster's rebirth. Commander Ulšulah upgrades an Altar (`upgrade`); from then on, on its talent clock
// (every 10 s from the Altar's start), it summons one Blood Amber on its branch. A killed pilot marks a random Altar
// (`markPilotReturn`): 20 s later that Altar summons the pilot on its pilot branch; destroyed first, the mark moves to
// another random Altar for a fresh 20 s. A marked Altar takes no second mark (one stack, no refresh). Neither the
// pending return nor the Amber clock holds the battle; the bodies they summon do.
import { bloodAltarDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { BLOOD_AMBER, BLOOD_ALTAR_BRANCH_USERS, BLOOD_ALTAR_PILOT, BLOOD_ALTAR_UNMODELLED } from '../../../shared/arkpedia/stage-blood-altar.js';
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
    const piloted = Object.hasOwn(stage?.enemies ?? {}, BLOOD_ALTAR_PILOT);
    const carriers = Object.keys(stage?.enemies ?? {}).filter(k => BLOOD_ALTAR_BRANCH_USERS.includes(k));
    for (const d of altars) {
      if (d.hidden) throw Error('Hidden Bloodcalling Altar requires an activation controller');
      const spec = bloodAltarDefinition(d.instance);
      // 13-19's Altars name branches the level lacks: accepted only where nothing can carry a mark that runs one.
      if (!b.stageBranches?.branches[spec.branchId] && (!b.stageBranches || carriers.length))
        throw Error(`Missing Bloodcalling Altar branch program: ${spec.branchId}`);
      if (spec.outsetAlias && !b.stageBombLoaders?.hidden?.has(spec.outsetAlias)) throw Error(`Missing hidden Loading Point: ${spec.outsetAlias}`);
      if (piloted && !b.stageBranches.branches[spec.pilotBranchId]) throw Error(`Missing Bloodcalling Altar pilot branch: ${spec.pilotBranchId}`);
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, def: spec.def, res: spec.res, blockCnt: 0, dir: spec.direction });
      if (!unit) throw Error(`Occupied Bloodcalling Altar tile: ${d.row},${d.col}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = `stage-device:${d.key}:${d.row}:${d.col}`;
      b.changeDeviceSide(unit, 'enemy');
      // Trap category: no character selector takes it, so nothing attacks it.
      b.addBuff(unit, { key: 'stage:bloodAltar', persist: true,
        flags: { invulnerable: true, untargetable: true, noMove: true, noDisplace: true, disarm: true, unblockable: true } });
      this.entries.push({ unit, spec, row: d.row, col: d.col, sp: spec.initSp, pulse: null, pulses: 0, conversions: 0,
        upgraded: false, amberClock: spec.amberInterval, ambers: 0, pilotReturn: null, pilotReturns: 0 });
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
  /** Altars the pilot's Charge may take (`trap_bonore_need_upgrade`): live, not destroyed, not upgraded. */
  upgradable() { return this.entries.filter(a => a.unit.alive && !a.destroyed && !a.upgraded); }
  /** The Charge trigger's post-filter 11 (PRTS: the nearest); ties by placement order. */
  nearestUpgradable(e) {
    let best = null, d = Infinity;
    for (const a of this.upgradable()) { const n = (a.col - e.x) ** 2 + (a.row - e.y) ** 2; if (n < d - 1e-9) { best = a; d = n; } }
    return best;
  }
  /** trap_bonore_upgraded[trigger]: the need-upgrade mark finishes and the Altar is upgraded for good. */
  upgrade(a) {
    if (!a?.unit.alive || a.destroyed || a.upgraded) return false;
    a.upgraded = true; return true;
  }
  /** enemy_spilot_reborn[trigger] / enemy_spilot_reborn[bonore]: one random live Altar (`exclude` aside) gets the
   * pilot's return, unless it already holds one. */
  markPilotReturn(delay, exclude = null) {
    const live = this.entries.filter(a => a !== exclude && a.unit.alive && !a.destroyed);
    if (!live.length || !(delay > 0)) return null;
    const a = live[live.length === 1 ? 0 : this.battle.rng.int(live.length)];
    if (a.pilotReturn) return null;
    a.pilotReturn = { left: delay, delay };
    return a;
  }
  tick(dt) {
    for (const a of this.entries) {
      if (!a.unit.alive) { a.pulse = null; continue; }
      // Talent `1` (trap_bonore_upgraded[summon]): every amberInterval s from the start, one Blood Amber once upgraded.
      a.amberClock -= dt;
      while (a.amberClock <= 1e-9) {
        a.amberClock += a.spec.amberInterval;
        if (a.upgraded && !a.destroyed) { this.battle.stageBranches.summonFollowRoute(a.spec.branchId, a.spec.amberEnemy); a.ambers++; }
      }
      if (a.pilotReturn && (a.pilotReturn.left -= dt) <= 1e-9) {
        a.pilotReturn = null; a.pilotReturns++;
        this.battle.stageBranches.start(a.spec.pilotBranchId, { blockGameFinish: false });
      }
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
   * ActivePredifinedInst activates the instance its `ActiveOutset.alias` names: a hidden Loading Point (13-11, 13-15,
   * 13-16); without one it activates nothing. */
  destroy(a) {
    if (!a?.unit.alive) return;
    a.pulse = null; a.destroyed = true;
    // enemy_spilot_reborn[bonore], ON_OWNER_KILLED: the pending return moves to another Altar for a fresh duration.
    const pending = a.pilotReturn; a.pilotReturn = null;
    if (pending) this.markPilotReturn(pending.delay, a);
    this.battle.removeBuff(a.unit, 'stage:bloodAltar');
    this.battle.kill(a.unit, null);
    // trap_bonore_active_outset: ActivePredifinedInst (its `ActiveOutset.alias`), then InstantKill. The Loading Point
    // stands on the Altar's own tile, so it is placed once the Altar is gone, in the same instant.
    if (a.spec.outsetAlias) a.outset = this.battle.stageBombLoaders.reveal(a.spec.outsetAlias);
  }
  convert(a, hits) {
    const b = this.battle;
    for (const e of hits) {
      // trap_bonore_s: its mark count → that many branch phases (CreateBuffStacked, at most 10); the marks finish.
      // Amber's mark end kills it (enemy_dseed_bonore[action]); a Collector's only empties it.
      // A drifting Boneguard (enemy_spnwiz_ghost_mark) takes the other branch: trap_bonore_spnwiz_revive[trigger]
      // finishes its ghost mark, which revives it (enemy-boneguard runtime), and its mark finishes; no phase runs.
      if (isGhost(e)) { e.mem.boneguardRevive = true; continue; }
      if (!b.stageBranches.branches[a.spec.branchId]) throw Error(`Bloodcalling Altar pulse needs a missing branch: ${a.spec.branchId}`);
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
