// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16: Toxic Pollution (PRTS 高危污染) and the three devices around it. Reviewed in shared/arkpedia/stage-mainline16.js (the
// system and its hide buff) and stage-mainline16-devices.js (the devices).
// - A tile is polluted while a living Heavily Polluted Facility covers it, unless a Miner Guerrilla cleared it within
//   the last 3 s or an ally unit stands on it.
// - Every 0.3 s each enemy-side unit that is not blocked and stands on a polluted tile is hidden (the engine's stealth:
//   it cannot be selected until it is blocked or leaves); otherwise it is shown. Operators cannot be deployed on a
//   polluted tile.
// - A Heavily Polluted Facility or a Rock Wall stops every Miner Guerrilla within its circle, and takes 5x damage from
//   them. A Rock Wall cannot be selected and holds its tile until it is destroyed.
// - A Hidden Tunnel gathers Miner Guerrillas (one every 15 s; at most 3 waiting and 5 alive). Its skill (15 SP) sends
//   out the ones waiting; used again it goes back to gathering.
import { pollutedFacilityDefinition, rockWallDefinition, hiddenTunnelDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { MINER_BODY } from './arkpedia-enemy-miner-guerrilla.js';

const CHECK = .3; // mainline16_enemy_target_free[trigger]
const DEVICE_BODY = .25; // the devices' own CircleCollider2D
const HIDDEN = 'stage:mainline16Hidden', BOUND = 'stage:mainline16Bound', WAIT = 'stage:minerStandby';
const FACILITY_TEXT = 'Spreads Toxic Pollution over the tiles around it: enemies there are hidden and operators cannot be deployed. Stops Miner Guerrillas, who deal 5x damage to it.';
const WALL_TEXT = 'Holds this tile. Cannot be targeted. Stops Miner Guerrillas, who deal 5x damage to it.';
const TUNNEL_TEXT = 'Gathers a Miner Guerrilla every 15 s (up to 3 waiting, 5 alive). Its skill sends out the ones waiting; use it again to gather.';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const key = (row, col) => `${row},${col}`;
// A walking unit's tile is where it is now; a placed one's is its own.
const tileOf = u => u.side === 'ally' && Number.isInteger(u.tileR) ? [u.tileR, u.tileC] : [Math.round(u.y), Math.round(u.x)];

export class StageMainline16 {
  constructor(b, devices, geometry, stage = null) {
    this.battle = b; this.entries = new Map(); this.facilities = []; this.walls = []; this.tunnels = [];
    this.cover = new Map(); this.cleared = new Map(); this.checkT = 0; this.hidden = new Set();
    const mine = devices.filter(d => stageDeviceSpec(d)?.mainline16);
    if (!mine.length) return;
    if (stage?.rules?.mainline16 !== true) throw Error('Chapter 16 devices require the pollution system');
    b.noDeployTiles ??= new Set();
    for (const d of mine) {
      const spec = stageDeviceSpec(d), id = `stage-device:${d.key}:${d.row}:${d.col}`;
      if (d.hidden) throw Error(`Hidden chapter 16 device requires an activation controller: ${d.key}`);
      if (spec.hiddenTunnel) this.placeTunnel(d, id); else this.placeEnemyDevice(d, id, spec);
      b.noDeployTiles.add(key(d.row, d.col));
    }
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  placeEnemyDevice(d, id, family) {
    const b = this.battle, spec = family.pollutedFacility ? pollutedFacilityDefinition(d.instance) : rockWallDefinition(d.instance);
    const unit = b.spawnDevice(d.key, d.row, d.col, { side: 'enemy', name: d.name, hp: spec.hp, def: spec.def, res: spec.res, blockCnt: 0 });
    if (!unit) throw Error(`Occupied ${d.name} tile: ${d.row},${d.col}`);
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id; unit.base.tauntLevel = spec.taunt;
    unit.profile.characterLikeDevice = true; unit.profile.holdsBattle = false;
    if (spec.immune) unit.def.immune = new Set(spec.immune);
    unit.markDirty();
    b.addBuff(unit, { key: 'stage:mainline16Device', persist: true,
      flags: { noMove: true, noDisplace: true, disarm: true, ...(family.rockWall ? { untargetable: true } : {}) } });
    const entry = { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, state: 'standing', facility: !!family.pollutedFacility,
      tiles: (spec.range ?? []).map(([r, c]) => [d.row + r, d.col + c]).filter(([r, c]) => b.grid.inRect(r, c)),
      spec: { ...spec, kind: family.pollutedFacility ? 'polluted-facility' : 'rock-wall', passive: true,
        description: family.pollutedFacility ? FACILITY_TEXT : WALL_TEXT, range: spec.range ?? [[0, 0]] } };
    Object.defineProperty(entry.spec, 'statusLabel', { enumerable: true, get: () => entry.unit.alive ? `${Math.ceil(entry.unit.hp)} HP` : 'Destroyed' });
    if (entry.facility) {
      // fowstn_t[shadow_tile] ON_BUFF_START: its range is shadowed for as long as it lives.
      for (const [r, c] of entry.tiles) this.cover.set(key(r, c), (this.cover.get(key(r, c)) ?? 0) + 1);
      unit.rangeKeys = entry.tiles.map(([r, c]) => r * b.grid.cols + c);
      this.facilities.push(entry);
    } else this.walls.push(entry);
    this.entries.set(id, entry);
  }
  placeTunnel(d, id) {
    const b = this.battle, spec = hiddenTunnelDefinition(d.instance);
    if (!b.stageBranches?.branches[spec.branchId]?.spawns?.some(a => a.order === spec.actionIndex)) throw Error(`Missing Hidden Tunnel branch action: ${spec.branchId}/${spec.actionIndex}`);
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, def: spec.def, blockCnt: 0 });
    if (!unit) throw Error(`Occupied Hidden Tunnel tile: ${d.row},${d.col}`);
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id; unit.base.tauntLevel = spec.taunt; unit.markDirty();
    // An obstacle-category ally trap: no enemy selector takes it.
    b.addBuff(unit, { key: 'stage:hiddenTunnel', persist: true, flags: { untargetable: true, invulnerable: true, noMove: true, noDisplace: true, disarm: true, noHeal: true } });
    const entry = { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, state: 'standby', sp: spec.initSp, summonT: 0, miners: new Set(), sent: 0, uses: 0,
      spec: { ...spec, kind: 'hidden-tunnel', description: TUNNEL_TEXT, range: [[0, 0]] } };
    Object.defineProperty(entry.spec, 'statusLabel', { enumerable: true, get: () => {
      const waiting = this.waiting(entry).length, alive = this.alive(entry).length;
      return `${entry.state === 'standby' ? `Gathering · ${Math.floor(entry.sp)} / ${spec.spCost} SP` : 'Sending out'} · ${waiting} waiting, ${alive} alive`;
    } });
    Object.defineProperty(entry.spec, 'actionLabel', { enumerable: true, get: () => entry.state === 'standby' ? 'Send out' : 'Gather' });
    this.tunnels.push(entry); this.entries.set(id, entry);
  }

  // ----- pollution -----
  /** A living facility covers the tile, no Miner Guerrilla cleared it lately, and no ally unit stands on it. */
  polluted(row, col) {
    const k = key(row, col), b = this.battle;
    if (!(this.cover.get(k) > 0) || this.cleared.get(k) > b.time + 1e-9) return false;
    return !b.allyUnits.some(u => live(u) && u.kind !== 'device' && !u.isFlying && tileOf(u)[0] === row && tileOf(u)[1] === col);
  }
  /** Every polluted tile, for the drawing. */
  pollutedTiles() {
    const out = [];
    for (const [k, n] of this.cover) if (n > 0) { const [r, c] = k.split(',').map(Number); if (this.polluted(r, c)) out.push([r, c]); }
    return out;
  }
  /** mcreep_t[work_espace_shadow]: the tile and the eight around it stay clear until `duration` from now. */
  clearAround(unit, duration) {
    const [row, col] = tileOf(unit), until = this.battle.time + duration;
    for (let r = row - 1; r <= row + 1; r++) for (let c = col - 1; c <= col + 1; c++) this.cleared.set(key(r, c), until);
  }

  // ----- Miner Guerrillas -----
  /** The devices a Miner Guerrilla may strike: those its attack circle reaches, and the one holding it. */
  minerTargets(miner, radius) {
    return [...this.facilities, ...this.walls].filter(d => d.unit.alive
      && (miner.mem.mainline16Bound === d || Math.hypot(d.col - miner.x, d.row - miner.y) <= radius + DEVICE_BODY + 1e-9)).map(d => d.unit);
  }
  /** trap_fowstn_t[damage_scale]: the scale on a Miner Guerrilla's damage to this unit. */
  minerScale(target) {
    const d = this.entries.get(target?.mem?.stageDeviceId);
    return d?.unit === target ? d.spec.minerDamageScale ?? 1 : 1;
  }
  waiting(tunnel) { return [...tunnel.miners].filter(m => m.alive && m.mem.minerStandby === tunnel); }
  alive(tunnel) { return [...tunnel.miners].filter(m => m.alive); }

  // ----- the Hidden Tunnel's skill -----
  error(id) {
    const d = this.entries.get(id), b = this.battle;
    if (!d || d.spec.kind !== 'hidden-tunnel' || !d.unit.alive) return 'This device is no longer available.';
    if (b.finished) return 'The battle has ended.';
    if (d.state === 'standby' && d.sp + 1e-9 < d.spec.spCost) return 'The device is charging.';
    return null;
  }
  /** sktok_spawnp: standby -> sortie frees every Miner Guerrilla this tunnel holds; used again it gathers from 0 SP. */
  activate(id) {
    const error = this.error(id); if (error) throw Error(error);
    const d = this.entries.get(id), b = this.battle;
    d.uses++;
    if (d.state === 'standby') {
      d.state = 'sortie'; d.sp = 0;
      for (const m of this.waiting(d)) { m.mem.minerStandby = null; b.removeBuff(m, WAIT); d.sent++; }
    } else { d.state = 'standby'; d.sp = 0; }
    b.fx?.('pulse', { x: d.col, y: d.row, id: d.unit.id, kind: 'hiddenTunnel' });
  }
  summon(d) {
    const b = this.battle;
    // spawnp_t[summon_trigger]: both limits are checked before the mode.
    if (this.waiting(d).length >= d.spec.maxWaiting || this.alive(d).length >= d.spec.maxCount) return null;
    const m = b.stageBranches.summonUnharmfulAction(d.spec.branchId, d.spec.actionIndex);
    if (!m) return null;
    d.miners.add(m); m.mem.minerTunnel = d;
    if (d.state === 'standby') { m.mem.minerStandby = d; b.addBuff(m, { key: WAIT, persist: true, flags: { noMove: true } }); }
    return m;
  }

  tick(dt) {
    const b = this.battle;
    for (const d of this.facilities) if (d.state === 'standing' && !d.unit.alive) {
      // fowstn_t[shadow_tile] ON_BUFF_FINISH
      d.state = 'destroyed';
      for (const [r, c] of d.tiles) this.cover.set(key(r, c), Math.max(0, (this.cover.get(key(r, c)) ?? 0) - 1));
      b.noDeployTiles.delete(key(d.row, d.col));
    }
    for (const d of this.walls) if (d.state === 'standing' && !d.unit.alive) { d.state = 'destroyed'; b.noDeployTiles.delete(key(d.row, d.col)); }
    // StopMcreep: a Miner Guerrilla inside a standing device's circle cannot move.
    const stops = [...this.facilities, ...this.walls].filter(d => d.unit.alive);
    for (const m of b.neutralUnits) {
      if (!m.mem?.minerGuerrilla) continue;
      const by = live(m) && !m.isFlying ? stops.filter(d => Math.hypot(d.col - m.x, d.row - m.y) <= d.spec.stopRadius + MINER_BODY + 1e-9)
        .sort((x, y) => Math.hypot(x.col - m.x, x.row - m.y) - Math.hypot(y.col - m.x, y.row - m.y))[0] ?? null : null;
      if (by && !m.findBuff(BOUND)) b.addBuff(m, { key: BOUND, persist: true, flags: { noMove: true } });
      else if (!by && m.alive && m.findBuff(BOUND)) b.removeBuff(m, BOUND);
      m.mem.mainline16Bound = by;
    }
    for (const d of this.tunnels) {
      for (const m of d.miners) if (!m.alive) d.miners.delete(m);
      if (!d.unit.alive || b.finished) continue;
      if (d.state === 'standby') d.sp = Math.min(d.spec.spCost, d.sp + d.spec.spPerSecond * dt);
      d.summonT += dt;
      if (d.summonT + 1e-9 >= d.spec.interval) { d.summonT -= d.spec.interval; this.summon(d); }
    }
    // mainline16_enemy_target_free[trigger]
    this.checkT += dt;
    if (this.checkT + 1e-9 < CHECK) return;
    this.checkT -= CHECK;
    for (const u of this.hidden) if (!u.alive) this.hidden.delete(u);
    for (const u of b.enemies) {
      if (!live(u)) continue;
      const hide = !u.blockedBy && this.polluted(...tileOf(u));
      if (hide && !this.hidden.has(u)) { this.hidden.add(u); b.addBuff(u, { key: HIDDEN, persist: true, flags: { stealth: true }, data: { stealthRestore: 0 } }); }
      else if (!hide && this.hidden.has(u)) { this.hidden.delete(u); b.removeBuff(u, HIDDEN); }
    }
  }
}
