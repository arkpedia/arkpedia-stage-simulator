// SPDX-License-Identifier: GPL-3.0-or-later
// 14-18: the Kindling Revenant's guns, cores and beam system. Reviewed in shared/arkpedia/stage-kindling-revenant.js
// (devices, beam rule) and shared/arkpedia/enemy-kindling-revenant-features.js (both forms); the forms' own clocks are in
// arkpedia-enemy-kindling-revenant.js, which calls adoptFirst / adoptSecond / bossTrigger / secondDied here.
// First form (the controller; `first`):
// - Soul Echo k (forced `intervals[k]` s after the form starts, or after the guns stopped): the guns fire after 0.5 s and
//   the core whose `unlock` is k + 1 loses its invincibility. The fourth Echo adds `lastEchoAtk` to the guns for good.
// - A firing gun: every 1 s each non-device ally unit in its row is touched; only the one with no other ally to its
//   right takes Arts damage of the gun's ATK (the first form's ATK, +20 for each absorbed Soul Maelstrom).
// - Every 0.5 s an exposed core at 1 HP or less is broken: invincible again, and its branch runs its next phase.
// - Every 1 s the controller reads the broken count: on a change the guns stop (their end clears the absorbed-soul
//   ATK, except after the third Echo) and the next Echo is timed; with every core broken the guns shut down, the
//   cores stop absorbing, and `reborn` s later the wave is released and the second form appears on the first's tile.
// - `deadline` s in, unless the second form was called: `lifeLoss` life points are lost and the first form dies.
// Second form (`second`): its casts call bossTrigger: the first starts the beams and switches every core to its
// second mode (full HP, takes no damage, 1 SP for each hit taken, taunt -1 while full); each adds 1 enemy energy.
// A core's skill (25 SP, player-activated) adds 1 ally energy, starts the gold beams and locks the other cores 1.8 s.
// Every `interval` s the beams deal their damage where they reach (revenantBeamReach).
import { revenantCoreDefinition, revenantGunDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { revenantBeamDamage, revenantBeamReach, SOUL_MAELSTROM } from '../../../shared/arkpedia/stage-kindling-revenant-beams.js';
import { stageEnemyKey } from '../../../shared/arkpedia/stage-rules.js';

const live = u => u?.alive && u.deployed !== false && !u.hidden;
const tile = u => [Math.round(u.tileR ?? u.y), Math.round(u.tileC ?? u.x)];
const due = (b, at) => at != null && b.time + 1e-9 >= at;
const CORE_TEXT = 'In the Kindling Revenant\'s second form: fires the gold beams and pushes the red beams back one step. Charged by hits taken.';
const GUN_TEXT = 'Fires down its row to the left. Controlled by the Kindling Revenant, then by the Core Amplifiers.';

export class StageKindlingRevenant {
  constructor(b, devices, geometry, stage = null) {
    this.battle = b; this.entries = new Map(); this.cores = []; this.guns = [];
    this.first = null; this.second = null; this.souls = 0; this.gunBonus = 0; this.gunSync = 0; this.absorbing = true;
    this.beams = { on: false, enemy: 0, ally: 0, gold: false, next: null, ticks: 0 };
    const cores = devices.filter(d => stageDeviceSpec(d)?.revenantCore), guns = devices.filter(d => stageDeviceSpec(d)?.revenantGun);
    if (!cores.length && !guns.length) return;
    const rule = this.rule = stage?.rules?.revenantBeams;
    const specs = cores.map(d => revenantCoreDefinition(d.instance));
    if (!rule || !guns.length || guns.length !== rule.rows || guns.some(d => d.col !== rule.allyStartCol || d.hidden) || cores.some(d => d.hidden)
      || new Set(guns.map(d => d.row)).size !== guns.length
      || specs.map(s => s.unlock).sort().join() !== cores.map((_, i) => i + 1).join())
      throw Error('Unsupported Kindling Revenant stage layout');
    this.rows = guns.map(d => d.row).sort((x, y) => x - y);
    for (const d of guns) {
      const spec = revenantGunDefinition(d.instance), id = `stage-device:${d.key}:${d.row}:${d.col}`;
      const unit = b.spawnDevice(d.key, d.row, d.col, { side: 'enemy', name: d.name, hp: spec.hp, blockCnt: 0, dir: spec.direction });
      if (!unit) throw Error(`Occupied Torrent Beam Activator tile: ${d.row},${d.col}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id; unit.profile.holdsBattle = false;
      b.addBuff(unit, { key: 'stage:revenantGun', persist: true,
        flags: { invulnerable: true, untargetable: true, noMove: true, noDisplace: true, disarm: true, unblockable: true } });
      const gun = { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, firing: null, touched: new Map(), fired: 0,
        spec: { ...spec, kind: 'torrent-beam', passive: true, description: GUN_TEXT, range: [[0, 0]] } };
      Object.defineProperty(gun.spec, 'statusLabel', { enumerable: true, get: () => this.second ? this.beams.gold ? 'Firing gold beams' : 'Idle'
        : gun.firing ? `Firing · ${Math.round(this.gunAtk())} ATK` : 'Idle' });
      this.guns.push(gun); this.entries.set(id, gun);
    }
    for (const [i, d] of cores.entries()) {
      const spec = specs[i], id = `stage-device:${d.key}:${d.row}:${d.col}`;
      if (spec.branchId && !Array.isArray(b.stageBranches?.branches[spec.branchId]?.sequencePhases)) throw Error(`Missing Core Amplifier branch: ${spec.branchId}`);
      const unit = b.spawnDevice(d.key, d.row, d.col, { side: 'enemy', name: d.name, hp: spec.hp, def: spec.def, res: spec.res, blockCnt: 0 });
      if (!unit) throw Error(`Occupied Core Amplifier tile: ${d.row},${d.col}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id;
      unit.profile.characterLikeDevice = true; unit.profile.holdsBattle = false;
      unit.def.immune = new Set(spec.immune); unit.markDirty();
      // Mode Default: UNDEADABLE, and INVINCIBLE until a Soul Echo exposes it. It never moves or heals, and its own side
      // cannot select it (ALLY_TARGET_FREE: no enemy aura or heal takes it).
      b.addBuff(unit, { key: 'stage:revenantCore', persist: true, flags: { undeadable: true, isolated: true, noMove: true, noDisplace: true, disarm: true, noHeal: true, healFree: true } });
      b.addBuff(unit, { key: 'stage:revenantCoreSealed', persist: true, flags: { invulnerable: true } });
      const core = { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, sp: spec.initSp, state: 'sealed', exposed: false, broken: false,
        second: false, lockUntil: -Infinity, checkAt: null, tauntAt: null, uses: 0,
        spec: { ...spec, kind: 'core-amplifier', description: CORE_TEXT, range: [[0, 0]] } };
      Object.defineProperty(core.spec, 'statusLabel', { enumerable: true, get: () => !core.second
        ? core.exposed ? `Exposed · ${Math.ceil(core.unit.hp)} HP` : core.broken ? 'Broken' : 'Invincible'
        : `${Math.floor(core.sp)} / ${spec.spCost} SP` });
      this.cores.push(core); this.entries.set(id, core);
    }
    this.cores.sort((x, y) => x.spec.unlock - y.spec.unlock);
    // The devices hold their tiles: nothing can be deployed on a gun or a core.
    b.noDeployTiles ??= new Set();
    for (const d of [...this.guns, ...this.cores]) b.noDeployTiles.add(`${d.row},${d.col}`);
    b.on('tick', ({ dt }) => this.tick(dt));
    // A second-mode core takes no damage; each hit an opposing unit lands on it charges 1 SP (INCREASE_WHEN_TAKEN_DAMAGE).
    b.on('hit', ctx => {
      const core = this.cores.find(c => c.unit === ctx.target);
      if (!core?.second) return;
      if (ctx.source && ctx.source.side !== core.unit.side && ctx.dmg?.type !== 'element' && core.sp < core.spec.spCost) core.sp = Math.min(core.spec.spCost, core.sp + 1);
      ctx.cancel = true;
    });
  }
  gunAtk() { return this.gunSync + this.souls * (this.cores[0]?.spec.soulAtk ?? 0) + this.gunBonus; }
  get beamReach() { const s = this.beams; return s.on ? revenantBeamReach(this.rule, s.enemy, s.ally, s.gold) : { red: null, gold: null, bossHit: false }; }

  // ----- first form -----
  /** enemy_lrking[init]: the first form takes the guns and cores. */
  adoptFirst(e, p) {
    if (this.first || !this.cores.length) throw Error('Kindling Revenant requires its own guns and cores');
    const b = this.battle;
    this.gunSync = e.s.atk; // trap_lrlgun[syncAtk]: its ATK at this moment
    this.first = { unit: e, p, left: this.cores.length, seen: this.cores.length, echo: null, echoes: 0, echoAt: b.time + p.intervals[0],
      ctrlAt: b.time + p.ctrlCheck, deadlineAt: b.time + p.deadline, rebornAt: null, done: false, lost: false };
    for (const c of this.cores) c.checkAt = b.time + p.coreCheck;
  }
  /** LaserDefault / LaserS1 / LaserS2 / LaserS3. */
  echo(index) {
    const f = this.first, b = this.battle, core = this.cores[index];
    f.echoAt = null; f.echo = { index, core, at: b.time }; f.echoes++;
    for (const g of this.guns) { g.firing = { mode: index, at: b.time + g.spec.windUp }; g.touched.clear(); g.fired++; }
    if (index === this.cores.length - 1) this.gunBonus += f.p.lastEchoAtk; // enemy_lrking[atk_boost]
    if (core && !core.broken) { core.exposed = true; core.state = 'exposed'; b.removeBuff(core.unit, 'stage:revenantCoreSealed'); }
    b.fx?.('pulse', { x: f.unit.x, y: f.unit.y, id: f.unit.id, kind: 'revenantEcho' });
  }
  /** `laser` interrupted: its end event clears the absorbed-soul ATK in the modes that carry trap_lrlgun[clearBuff]. */
  stopGuns() {
    let cleared = false;
    for (const g of this.guns) { if (g.firing && g.spec.clearsSouls[g.firing.mode]) cleared = true; g.firing = null; g.touched.clear(); }
    if (cleared) this.souls = 0;
  }
  tickFirst() {
    const f = this.first, b = this.battle;
    if (!f || f.lost) return;
    if (!f.unit.alive) { f.lost = true; this.stopGuns(); return; }
    if (!f.done && due(b, f.echoAt)) this.echo(this.cores.length - f.left);
    // enemy_lrking[initCore], every 0.5 s on each core: an exposed core at 1 HP or less is broken.
    for (const c of this.cores) while (!c.second && due(b, c.checkAt)) {
      c.checkAt += f.p.coreCheck;
      if (!c.exposed || c.unit.hp > 1 + 1e-9) continue;
      c.exposed = false; c.broken = true; c.state = 'broken'; f.left--;
      b.addBuff(c.unit, { key: 'stage:revenantCoreSealed', persist: true, flags: { invulnerable: true } });
      if (c.spec.branchId) b.stageBranches.advanceSpawns(c.spec.branchId);
    }
    // enemy_lrking[ctrl], every 1 s.
    while (!f.done && due(b, f.ctrlAt)) {
      f.ctrlAt += f.p.ctrlCheck;
      if (f.left > 0) {
        if (f.left === f.seen) continue;
        f.seen = f.left; f.echo = null; this.stopGuns();
        f.echoAt = b.time + f.p.intervals[this.cores.length - f.left];
        continue;
      }
      // enemy_lrking[suicide][p1]: shut down, stop absorbing, and call the second form.
      f.done = true; f.echo = null; f.deadlineAt = null; this.stopGuns(); this.absorbing = false;
      f.rebornAt = b.time + f.p.reborn;
    }
    if (due(b, f.rebornAt)) {
      f.rebornAt = null;
      b.stageWaveScheduler?.releaseCurrentWave(null);
      this.summonSecond();
    }
    // enemy_lrking[suicide_p1]
    if (due(b, f.deadlineAt)) {
      f.deadlineAt = null; f.lost = true; this.stopGuns();
      b.life -= f.p.lifeLoss; b.removeBuff(f.unit, 'ab:revenantFirst'); b.kill(f.unit, null);
    }
  }
  /** SummonEnemyWithRuntimeRoute: the second form on the first's tile; unharmful, it never walks. */
  summonSecond() {
    const f = this.first, b = this.battle;
    if (b.finished) return null;
    const e = b.spawnEnemy(stageEnemyKey(b.stageCardRules, f.p.second), { pos: [f.unit.y, f.unit.x], countInTotal: false,
      tag: 'stage-revenant:second', ownerPlayerId: 'arkpedia' });
    if (e) { e.mem.stageWaveUnharmful = true; e.counted = false; }
    return e;
  }
  /** trap_lrcore[captureSoul]: a ground Soul Maelstrom within reach of a first-mode core is absorbed. */
  absorb() {
    const b = this.battle;
    if (!this.absorbing || !this.first || this.first.lost) return;
    for (const c of this.cores) {
      if (c.second || !live(c.unit)) continue;
      for (const e of b.enemies) {
        if (!live(e) || e.isFlying || (e.def?.key ?? e.defId) !== SOUL_MAELSTROM || e.mem.revenantAbsorbed) continue;
        if ((e.x - c.col) ** 2 + (e.y - c.row) ** 2 > c.spec.soulRadius ** 2 + 1e-9) continue;
        e.mem.revenantAbsorbed = true; this.souls++;
        b.fx?.('pulse', { x: c.col, y: c.row, id: c.unit.id, kind: 'revenantAbsorb' });
        b.kill(e, null);
      }
    }
  }
  /** One firing gun: every ally unit in its row is touched once a second; the one nearest the gun takes the damage. */
  fire(g) {
    const b = this.battle;
    if (!g.firing || !due(b, g.firing.at)) return;
    const row = b.allyUnits.filter(u => live(u) && (u.kind !== 'device' || u.profile?.characterLikeDevice) && tile(u)[0] === g.row && u.x < g.col);
    const front = row.reduce((best, u) => !best || u.x > best.x ? u : best, null);
    for (const u of row) {
      if (b.time + 1e-9 < (g.touched.get(u) ?? -Infinity)) continue;
      g.touched.set(u, b.time + g.spec.rehit);
      if (u === front) b.dealDamage(g.unit, u, { amount: this.gunAtk(), type: 'arts', applyWay: 'ranged', tags: ['revenant:echo'] });
    }
    for (const u of [...g.touched.keys()]) if (!live(u)) g.touched.delete(u);
  }

  // ----- second form and the beams -----
  adoptSecond(e) {
    this.second = e;
  }
  /** Mainline14TriggerSkill from the boss: the first starts the beams and gives the cores their second mode. */
  bossTrigger() {
    const s = this.beams, b = this.battle;
    if (!s.on) {
      s.on = true; s.next = b.time + this.rule.interval;
      for (const c of this.cores) this.secondMode(c);
    }
    s.enemy++;
  }
  /** enemy_lrdead[switchmode]: mode S1. */
  secondMode(c) {
    const b = this.battle;
    if (c.second || !c.unit.alive) return;
    c.second = true; c.exposed = false; c.state = 'charging'; c.tauntAt = b.time + c.spec.tauntCheck;
    b.removeBuff(c.unit, 'stage:revenantCoreSealed');
    c.unit.hp = c.unit.s.maxHp; // trap_lrcore[set_hp_full]
  }
  error(id) {
    const c = this.entries.get(id), b = this.battle;
    if (!c || c.spec.kind !== 'core-amplifier' || !c.unit.alive) return 'This device is not available.';
    if (b.finished) return 'The battle has ended.';
    if (!c.second || !this.beams.on) return 'Opens in the Kindling Revenant\'s second form.';
    if (c.sp + 1e-9 < c.spec.spCost) return 'The core is charging.';
    if (b.time + 1e-9 < c.lockUntil) return 'Another core was just used.';
    return null;
  }
  /** sktok_lrcore: one ally energy; the gold beams start with the first; the other cores are locked for a moment. */
  activate(id) {
    const error = this.error(id); if (error) throw Error(error);
    const c = this.entries.get(id), b = this.battle, s = this.beams;
    c.sp = 0; c.uses++; s.ally++; s.gold = true;
    for (const other of this.cores) if (other !== c) other.lockUntil = b.time + c.spec.lock;
    b.fx?.('pulse', { x: c.col, y: c.row, id: c.unit.id, kind: 'revenantCore' });
  }
  /** Mainline14InformLrdeadDeath. */
  secondDied() { this.beams.on = false; this.beams.next = null; }
  beamTick() {
    const s = this.beams, b = this.battle, rule = this.rule;
    const reach = revenantBeamReach(rule, s.enemy, s.ally, s.gold), inside = (u, cols) => {
      const [r, c] = tile(u); return !!cols && this.rows.includes(r) && c >= cols[0] && c <= cols[1];
    };
    s.ticks++;
    if (reach.red) {
      const amount = revenantBeamDamage(rule.enemy, s.enemy);
      for (const u of [...b.allyUnits]) if (live(u) && u.kind !== 'device' && inside(u, reach.red))
        b.dealDamage(null, u, { amount, type: 'arts', sourceless: true, noSp: true, canDodge: false, applyWay: 'none', tags: ['revenant:redBeam'] });
    }
    if (reach.gold) {
      const amount = revenantBeamDamage(rule.ally, s.ally);
      for (const e of [...b.enemies]) if (live(e) && e.kind !== 'device' && e !== this.first?.unit && e !== this.second && inside(e, reach.gold))
        b.dealDamage(null, e, { amount, type: 'true', sourceless: true, noSp: true, canDodge: false, applyWay: 'none', tags: ['revenant:goldBeam'] });
      if (reach.bossHit && live(this.second) && !this.second.s.flags.invulnerable)
        b.dealDamage(null, this.second, { amount: amount * rule.bossScale, type: 'true', sourceless: true, noSp: true, canDodge: false, applyWay: 'none', tags: ['revenant:goldBeam'] });
    }
  }
  tick() {
    const b = this.battle;
    if (!this.cores.length || b.finished) return;
    this.tickFirst();
    this.absorb();
    for (const g of this.guns) this.fire(g);
    // trap_lrcore[p2_taunt_ctrl], every 0.5 s.
    for (const c of this.cores) while (c.second && due(b, c.tauntAt)) {
      c.tauntAt += c.spec.tauntCheck;
      const taunt = c.sp + 1e-9 >= c.spec.spCost ? c.spec.tauntWhenFull : 0;
      if (c.unit.base.tauntLevel !== taunt) { c.unit.base.tauntLevel = taunt; c.unit.markDirty(); }
    }
    const s = this.beams;
    while (s.on && due(b, s.next)) { s.next += this.rule.interval; this.beamTick(); if (b.finished) return; }
  }
}
