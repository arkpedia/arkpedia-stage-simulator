// SPDX-License-Identifier: GPL-3.0-or-later
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
import { PILLAR, RUINS } from '../../../shared/arkpedia/device-runtime.js';
import { absoluteRangeKeys, auraSelectable } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { spawnStageObstacle } from './arkpedia-stage-obstacles.js';
const live = u => u.alive && u.deployed && !u.hidden;
const vector = { RIGHT: [0, 1], LEFT: [0, -1], UP: [1, 0], DOWN: [-1, 0] };
const adjacent = (a, u) => a && Math.abs(a.tileR - u.tileR) + Math.abs(a.tileC - u.tileC) === 1;

/** One battle-owned controller handles ordinary hits, demolition and chained pillars. */
export class StageDemolition {
  constructor(b) {
    this.b = b;
    for (const u of b.enemies) if (u.mem.stageUnitDevice?.pillar) {
      u.tags.add('dupilr');
      u.def.immune = new Set(['stun', 'cold', 'freeze', 'silence', 'bind', 'sleep']);
      b.addBuff(u, { key: 'pillar:body', persist: true, flags: { noDisplace: true, noBlock: true } });
      b.addBuff(u, { key: 'pillar:undead', persist: true, flags: { undeadable: true } });
    }
    b.on('elementHit', ctx => { if (ctx.target.mem.stageUnitDevice?.pillar) ctx.cancel = true; });
    b.on('hit', ctx => {
      const { source, target, dmg } = ctx, d = target.mem.stageUnitDevice;
      if (!d?.pillar) return;
      if (dmg.isEnvironment || !source || (!source.tags?.has('dupilr') && !adjacent(source, target))) {
        ctx.cancel = true; return;
      }
      d.lastSource = { r: source.tileR, c: source.tileC };
      if (source.tags?.has('dupilr')) { ctx.cancel = true; this.collapse(target); }
    });
    b.on('hpZeroAttempt', ({ unit }) => {
      const d = unit.mem.stageUnitDevice;
      if (!d?.pillar || d.state !== 'intact') return;
      d.state = 'damaged'; d.removeUndead = true;
      b.addBuff(unit, { key: 'pillar:damaged', duration: PILLAR.recovery, persist: true, visible: true,
        flags: { invulnerable: true, untargetable: true, isolated: true } });
    });
    // Remove UNDEADABLE only after its first lethal receipt has been clamped.
    b.on('damaged', ({ target }) => {
      const d = target.mem.stageUnitDevice;
      if (d?.removeUndead) { delete d.removeUndead; b.removeBuff(target, 'pillar:undead'); }
    });
    b.on('fatal', ctx => {
      const d = ctx.unit.mem.stageUnitDevice;
      if (!d?.pillar || d.state !== 'damaged') return;
      ctx.prevented = true; ctx.unit.hp = 1; this.collapse(ctx.unit);
    });
  }
  collapse(pillar) {
    const b = this.b, d = pillar.mem.stageUnitDevice;
    if (!live(pillar) || d.collapsed) return;
    d.collapsed = true; d.state = 'collapsing';
    const dr = d.row - (d.lastSource?.r ?? d.row), dc = d.col - (d.lastSource?.c ?? d.col - 1);
    const dir = Math.abs(dc) >= Math.abs(dr) ? (dc < 0 ? 'LEFT' : 'RIGHT') : (dr < 0 ? 'DOWN' : 'UP');
    pillar.dir = dir;
    b.addBuff(pillar, { key: 'pillar:collapse', persist: true, flags: { invulnerable: true, undeadable: true,
      untargetable: true, isolated: true, noBlock: true } });
    const keys = absoluteRangeKeys(PILLAR.range, d.row, d.col, dir);
    b.after(PILLAR.collapse, () => {
      if (!live(pillar)) return;
      for (const e of b.enemies.slice()) if (e !== pillar && live(e) && bodyInKeys(e, keys) && auraSelectable(pillar, e)) {
        b.dealDamage(pillar, e, { amount: pillar.s.atk, type: 'true', isSkill: true });
        if (e.alive) b.applyStatus(e, 'stun', { duration: PILLAR.stun, source: pillar });
      }
      for (const u of b.allyUnits.slice()) if (live(u) && bodyInKeys(u, keys) && !(u.kind === 'device' && u.obstacle)) b.kill(u, pillar);
      // The occupied origin is excluded by native spawn validation. Forward
      // buildable ground tiles receive real bodies with HP, blocking and removal.
      const [vr, vc] = vector[dir];
      for (let i = 1; i <= 2; i++) this.spawnRuins(d.row + vr * i, d.col + vc * i);
      b.kill(pillar, pillar);
    }, { holdsBattle: true });
  }
  spawnRuins(row, col) {
    const b = this.b;
    if (!['MELEE', 'ALL'].includes(b.grid.tile(row, col)?.build) || b.grid.isObstacle(row, col)) return null;
    const u = spawnStageObstacle(b, row, col, { unitId: 'trap_044_duruin', name: 'Battlefield Ruins', kind: 'obstacle',
      hp: RUINS.maxHp, def: RUINS.def, res: RUINS.magicResistance, block: RUINS.blockCnt,
      blockRadiusSquare: RUINS.blockRadiusSquare, taunt: RUINS.tauntLevel, cost: RUINS.cost, refundRatio: .5,
      immune: ['stun', 'freeze', 'silence', 'sleep'], environmentImmune: true, range: [],
      description: 'Blocks enemy routes. Has 100 HP and can block three enemies. Retreat to clear the tile.' });
    if (!u) return null;
    u.mem.battlefieldRuins = true;
    return u;
  }
  install(unit, spec, dir) {
    const b = this.b;
    configureStageSupply(unit, spec); unit.dir = dir; unit.tags.add('dupilr');
    unit.mem.demolitionBody = true;
    unit.mem.stageSupplyReleaseAt = b.time + spec.delay;
    unit.rangeKeys = absoluteRangeKeys(spec.range, unit.tileR, unit.tileC, dir);
    b.addBuff(unit, { key: 'demolition:body', persist: true, flags: { invulnerable: true, untargetable: true, healFree: true, noBlock: true } });
    b.after(spec.delay, () => {
      if (!live(unit)) return;
      const [dy, dx] = vector[dir];
      for (const e of b.enemies.slice()) if (live(e) && !e.isFlying && bodyInKeys(e, unit.rangeKeys)) {
        b.dealDamage(unit, e, { amount: spec.damage, type: 'true', isAttack: true });
        if (e.alive) b.push(e, spec.force, { from: unit, dir: { x: dx, y: dy }, onFall: fallen => b.kill(fallen, unit) });
      }
      b.kill(unit, unit);
    }, { holdsBattle: true });
  }
}
