// SPDX-License-Identifier: GPL-3.0-or-later
import { TileBuffField } from './arkpedia-tile-buff-field.js';
import { auraSelectable } from '../targeting.js';
const allyKey = 'rogue_4_apoptosis[ally]', enemyKey = 'rogue_4_apoptosis[enemy]';
function epochField(b, p) {
  if (b.stageEpoch) return b.stageEpoch;
  // Admission refuses this disaster until its other rules are implemented.
  if (b.stageEnvironments?.some(e => e.kind === 'rogue_4_disaster_buff_8'))
    throw Error('Unimplemented Epoch disaster withdrawal rule');
  b.stageEpoch = new TileBuffField(b, { enemyInterval: p.enemyInterval,
    selectable: u => u.alive && u.deployed && !u.hidden && ['ally', 'enemy'].includes(u.side)
      && (u.kind !== 'device' || u.profile.characterLikeDevice || u.profile.enemyTargetableDevice)
      && !u.s.flags.untargetable && !u.s.flags.targetFree && !u.s.flags.isolated && !u.s.flags.sleep,
    attach(u, params) {
      if (u.side === 'enemy') { b.addBuff(u, { key: enemyKey }); return; }
      b.addBuff(u, { key: allyKey, interval: params.interval, visible: true, onTick: () => {
        if (u.tags.has('rogue_4_skhbox')) return;
        b.dealDamage(null, u, { type: 'element', element: 'apoptosis', amount: params.amount,
          sourceless: true, isEnvironment: false, canDodge: false, tags: ['periodic', 'epoch'] });
      } });
    },
    detach(u) { b.removeBuff(u, allyKey); b.removeBuff(u, enemyKey); },
  });
  return b.stageEpoch;
}
export function epochMark(p) {
  return { spawn(b, e) {
    if (e.side !== 'neutral') throw Error('Epoch Mark requires its compiled neutral actor properties');
    e.profile.noAttack = true; e.profile.cannotExit = true; e.profile.holdsBattle = false; e.mem.noLeak = true;
    // EmptyAnimator is an effect-only actor, not a missing enemy body.
    e.mem.effectOnly = true;
    b.addBuff(e, { key: 'enemy_fake_t_apoptosis', persist: true,
      flags: { noMove: true, targetFree: true, invulnerable: true } });
    const row = Math.round(e.y), col = Math.round(e.x), tiles = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
      if (b.grid.inRect(row + dr, col + dc)) tiles.push([row + dr, col + dc]);
    epochField(b, p).add(e, tiles, p);
  } };
}
export function dreadkazBirth(p) {
  const fire = (b, e, a) => {
    if (a.fired) return;
    a.fired = true;
    if (a.timer) a.timer.cancel();
    const row = Math.round(e.y), col = Math.round(e.x);
    for (const u of b.allies(null, { includeTargetableDevices: true })) {
      if (Math.abs(u.tileR - row) > 1 || Math.abs(u.tileC - col) > 1 || !auraSelectable(e, u)) continue;
      // The source explicitly includes ALL motion; do not apply a ground
      // attack's liftoff exclusion to this tile-based birth action.
      b.dealDamage(e, u, { amount: e.s.atk * p.scale, type: 'arts', canDodge: false,
        isSkill: false, ignoreSelect: true, tags: ['enemyAbility', 'splash'] });
    }
    const mark = b.spawnEnemy(p.child, { pos: [row, col], countInTotal: false });
    if (mark) b.after(p.duration, () => { if (mark.alive) b.kill(mark); }, { owner: mark });
  };
  return {
    spawn(b, e, a) { a.timer = b.after(p.delay, () => fire(b, e, a), { owner: e }); },
    // The source action is ON_BUFF_FINISH, with no death-reason filter. Early
    // removal finishes the birth buff too, and must not fire it a second time.
    death(_c, b, e, a) { fire(b, e, a); },
  };
}
