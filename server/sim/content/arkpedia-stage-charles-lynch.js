// SPDX-License-Identifier: GPL-3.0-or-later
// Charles Lynch (trap_158_lrsteam; 14-10). Reviewed in shared/arkpedia/stage-charles-lynch.js. Hidden until its wave
// action deploys it on its tile (an occupied tile finishes without a body, as for a Shieldguard).
// - It blocks (99) and strikes one blocked ground enemy with an ordinary melee attack over its own tile and the one it
//   faces (the engine's ally attack loop, as a Shieldguard).
// - Cannot be healed; immune to Stun, Silence and Freeze.
// - Its skill charges from 116/120 SP at its SP recovery (1/s, lowered where Originium pollution lowers it); then, after a
//   2.83 s wind-up, three volleys 0.3 s apart each shell up to five ground enemies in the 3x3 area centred two tiles
//   ahead (random beyond five), Physical, ATK x2.05, landing 0.3 s after firing. It does not attack meanwhile (4 s).
import { charlesLynchDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { resolveProfile } from '../professions.js';
import { updateAlly } from '../ai.js';
import { rotateOffset } from '../dir.js';

const tileKey = u => `${Math.round(u.tileR ?? u.y)},${Math.round(u.tileC ?? u.x)}`;

export class StageCharlesLynch {
  constructor(b, devices) {
    this.battle = b; this.hidden = new Map(); this.units = [];
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.charlesLynch) continue;
      if (!(d.hidden === true && d.scheduledActivation === true && typeof d.alias === 'string') || this.hidden.has(d.alias))
        throw Error('Charles Lynch requires its own scheduled activation');
      this.hidden.set(d.alias, { d, spec: charlesLynchDefinition(d.instance), activated: false });
    }
    if (!this.hidden.size) return;
    b.on('tick', ({ dt }) => { for (const u of this.units) if (u.alive && u.deployed) this.tick(u, dt); });
  }
  /** ACTIVATE_PREDEFINED on its alias; false when the alias is not Charles Lynch. */
  activate(alias) {
    const entry = this.hidden.get(alias);
    if (!entry) return false;
    if (!entry.activated) { entry.activated = true; this.spawn(entry); }
    return true;
  }
  spawn({ d, spec }) {
    const b = this.battle;
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name ?? 'Charles Lynch', hp: spec.hp, atk: spec.atk, def: spec.def,
      res: spec.res, blockCnt: spec.block, bat: spec.bat, dir: spec.direction, obstacle: false, blockRadiusSquare: .5 });
    if (!unit) return null;
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0;
    unit.def.immune = new Set([...(unit.def.immune ?? []), ...spec.immune]);
    unit.def.rangeGrid = [[0, 0], [0, 1]];
    unit.base.spRecovery = 1;
    unit.profile = { ...resolveProfile({ type: 'device', profession: 'WARRIOR', subProf: null, stats: { atk: spec.atk } }),
      canHitFly: false, groundOnly: true, maxTargets: 1, characterLikeDevice: true, noHeal: true };
    const [r0, c0] = [d.row, d.col];
    const box = new Set([-1, 0, 1].flatMap(dr => [-1, 0, 1].map(dc => rotateOffset(dr, spec.box.ahead + dc, spec.direction)))
      .map(([dr, dc]) => `${r0 + dr},${c0 + dc}`));
    unit.mem.charlesLynch = { spec, sp: spec.sp, casting: false, casts: 0, volleys: 0, box };
    unit.markDirty();
    b.refreshRange(unit);
    this.units.push(unit);
    return unit;
  }
  tick(u, dt) {
    const m = u.mem.charlesLynch, b = this.battle;
    if (m.casting) return;
    m.sp = Math.min(m.spec.spCost, m.sp + dt * Math.max(0, u.s.spRecovery));
    if (m.sp + 1e-9 >= m.spec.spCost) this.cast(u);
    else updateAlly(b, u, dt);
  }
  cast(u) {
    const m = u.mem.charlesLynch, s = m.spec, b = this.battle;
    m.sp = 0; m.casting = true; m.casts++;
    for (let v = 0; v < s.volleys; v++) b.after(s.windUp + v * s.volleyGap, () => this.volley(u), { owner: u });
    b.after(s.castEvery, () => { m.casting = false; }, { owner: u });
  }
  volley(u) {
    const m = u.mem.charlesLynch, s = m.spec, b = this.battle;
    if (!u.alive) return;
    m.volleys++;
    const found = b.enemies.filter(e => e.alive && e.deployed !== false && !e.hidden && !e.isFlying && !e.mem.stageDeviceId
      && !e.s.flags.untargetable && m.box.has(tileKey(e)));
    // Random beyond five (`_alwaysRandomInTheEnd`).
    for (let i = found.length - 1; i > 0; i--) { const j = Math.floor(b.rng() * (i + 1)); [found[i], found[j]] = [found[j], found[i]]; }
    for (const e of found.slice(0, s.maxTargets)) {
      b.fx?.('explode', { x: e.x, y: e.y, r: .5, kind: 'charlesLynch' });
      b.after(s.shellDelay, () => {
        if (!u.alive || !e.alive) return;
        b.dealDamage(u, e, { amount: u.s.atk * s.atkScale, type: 'phys', isAttack: true, isSkill: true, applyWay: 'ranged',
          attackId: ++b._attackSeq, tags: ['charlesLynch:shell'] });
      }, { owner: u });
    }
  }
}
