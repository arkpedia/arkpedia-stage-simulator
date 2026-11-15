// SPDX-License-Identifier: GPL-3.0-or-later
import { capturableDeviceDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';

/** One recipient clock per aura key, even when several stations overlap. */
export class SupplyAura {
  constructor(battle) { this.battle = battle; this.recipients = new Map(); }
  update(sources, dt) {
    const b = this.battle, next = new Map();
    for (const d of sources) {
      if (d.state !== 'active' || !d.unit.alive) continue;
      const side = d.unit.side, spec = d.spec.recharge[side];
      for (const u of side === 'ally' ? b.allyUnits : b.enemies) {
        if (!u.alive || !u.deployed || u.hidden || u.removed || u.kind === 'device' || u.kind === 'token'
          || u.s.flags.isolated
          || !d.tiles.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
        // Native profession mask excludes summons/traps; TargetFree is ignored.
        const old = this.recipients.get(u);
        next.set(u, old?.side === side && old.life === u.deploySeq ? old : { side, life: u.deploySeq, elapsed: 0, spec });
      }
    }
    for (const [u, clock] of next) {
      clock.elapsed += dt;
      while (clock.elapsed + 1e-9 >= clock.spec.interval) {
        clock.elapsed -= clock.spec.interval;
        if (u.s.flags.noSp) continue;
        if (u.side === 'enemy') u.mem.enemyAmmo?.modify(clock.spec.amount);
        else u.skill?.gainSp(clock.spec.amount, 'stage:supplyStation');
      }
    }
    this.recipients = next;
  }
}

export class CapturableStageDevices {
  constructor(b, devices) {
    this.battle = b; this.entries = new Map(); this.aura = new SupplyAura(b);
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.capturable) continue;
      const spec = capturableDeviceDefinition(d.key, d.instance), id = `stage-device:${d.key}:${d.row}:${d.col}`;
      const stats = stageDeviceAttributes(b.stageCardRules, d.key, { atk: 0, block: 0, ...spec.stats }, spec.position);
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, ...stats, blockCnt: stats.block });
      if (!unit) throw Error(`Capturable device tile is occupied: ${id}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id;
      unit.profile.enemyTargetableDevice = true; unit.tags.add('TAG_TRAP_WPNSTS'); unit.base.tauntLevel = spec.taunt;
      b.addBuff(unit, { key: 'stage:captureIdentity', persist: true,
        flags: { isolated: true, healFree: true, noHeal: true, noMove: true, noDisplace: true, disarm: true },
        mods: { hpRegen: spec.regen } });
      const range = spec.range.map(([r, c]) => [d.row + r, d.col + c]);
      unit.rangeKeys = range.filter(([r, c]) => b.grid.inRect(r, c)).map(([r, c]) => r * b.grid.cols + c);
      const originalTile = b.grid.tile(d.row, d.col);
      b.grid.setTile(d.row, d.col, { ...originalTile, ...stageDeviceSpec(d).dynamicTile });
      const entry = { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, spec, originalTile,
        tiles: new Set(range.map(([r, c]) => `${r},${c}`)), state: 'active', activeAt: null, captures: 0 };
      this.entries.set(id, entry);
      b.changeDeviceSide(unit, spec.side);
    }
    if (!this.entries.size) return;
    const entry = u => this.entries.get(u?.mem?.stageDeviceId);
    b.on('beforeHpZero', ctx => { const d = entry(ctx.unit); if (d && d.state === 'active') this.capture(d); });
    b.on('fatal', ctx => {
      const d = entry(ctx.unit); if (d?.state !== 'rebooting') return;
      ctx.prevented = true; ctx.afterHpLoss = () => { ctx.unit.hp = Math.min(1, ctx.unit.s.maxHp); };
    });
    b.on('hit', ctx => { if (entry(ctx.target) && ctx.dmg.isEnvironment) ctx.cancel = true; });
    b.on('elementHit', ctx => { if (entry(ctx.target)) ctx.cancel = true; });
    b.on('beforeStatus', ctx => {
      if (entry(ctx.target) && ['stun', 'freeze', 'silence', 'cold', 'disarm', 'sleep'].includes(ctx.status)) ctx.cancel = true;
    });
    b.on('death', ({ unit }) => {
      const d = entry(unit); if (!d || d.state === 'spent') return;
      d.state = 'spent'; b.grid.setTile(d.row, d.col, d.originalTile);
    });
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  capture(d) {
    const b = this.battle, u = d.unit, formerSide = u.side;
    d.state = 'rebooting'; d.activeAt = b.time; d.captures++;
    // Snapshot recipients before nested damage can capture another station.
    const recipients = [...(formerSide === 'ally' ? b.allyUnits : b.enemies)];
    for (const target of recipients) {
      const f = target.s.flags;
      if (target === u || !target.alive || !target.deployed || target.hidden || target.removed
        || f.untargetable || f.isolated
        || !d.tiles.has(`${Math.round(target.y)},${Math.round(target.x)}`)) continue;
      b.dealDamage(u, target, { amount: d.spec.damage, type: 'arts', isAttack: true, tags: ['stage:captured'] });
      if (target.alive) b.applyStatus(target, 'stun', { duration: d.spec.stun, source: u });
    }
    for (const buff of [...u.buffs]) if (buff.key !== 'stage:captureIdentity') b.removeBuff(u, buff.key);
    b.addBuff(u, { key: 'stage:captureReboot', flags: { invulnerable: true, untargetable: true }, mods: { hpRegenMul: 0 } });
    b.changeDeviceSide(u, formerSide === 'ally' ? 'enemy' : 'ally');
    b.fx('explode', { x: u.x, y: u.y, r: 2, kind: 'arts' });
  }
  tick(dt) {
    const b = this.battle;
    // Rebooted auras begin accruing on the following step, not retroactively.
    this.aura.update(this.entries.values(), dt);
    for (const d of this.entries.values()) if (d.unit.alive && d.state === 'rebooting' && b.time + dt + 1e-9 >= d.activeAt + d.spec.duration) {
      b.removeBuff(d.unit, 'stage:captureReboot'); d.unit.hp = d.unit.s.maxHp;
      d.state = 'active'; d.activeAt = null;
      b.fx('pulse', { x: d.unit.x, y: d.unit.y, kind: 'supplyStation' });
    }
  }
}
