// SPDX-License-Identifier: GPL-3.0-or-later
// Allerdale's Guard (trap_087_allady): the card and 11-19's placed instances share this. Numbers arrive in `def` from
// the reviewed contract (shared/arkpedia/stage-allerdale.js, compiled as the alladyDefinition device family).
import { rotateOffset } from '../dir.js';

const STAY = 'trap_allady_t[stay]', SHIELD = 'allady_shield', POLL = .1;
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const tileOf = u => [Math.round(u.tileR ?? u.y), Math.round(u.tileC ?? u.x)];

export function installAllerdaleGuard(b, unit, def, dir) {
  if (def?.kind !== 'allerdale' || !['barrier', 'door'].includes(def.mode)) throw Error('Invalid Allerdale\'s Guard definition');
  const [r0, c0] = tileOf(unit);
  const reach = def.reach.map(([dr, dc]) => rotateOffset(dr, dc, dir)).map(([dr, dc]) => `${r0 + dr},${c0 + dc}`);
  const allies = () => b.allies(null, { includeTargetableDevices: true }).filter(u => live(u) && u !== unit);
  const die = () => { if (unit.alive) b.kill(unit); };
  unit.mem.allerdale = { mode: def.mode, state: 'start' };

  if (def.mode === 'door') {
    // The protection-point shield: a 0-ATK projectile at tile_end that only Steam Knight S can be hit by. No effect.
    b.after(def.start, () => {
      if (!unit.alive) return;
      unit.mem.allerdale.state = 'cast';
      b.after(def.cast + def.doorLinger, die, { owner: unit });
    }, { owner: unit });
    return unit;
  }

  const shieldAround = target => {
    const [tr, tc] = tileOf(target);
    const area = new Set(def.area.map(([dr, dc]) => `${tr + dr},${tc + dc}`));
    for (const u of b.allies(null, { includeTargetableDevices: true })) {
      if (!live(u) || !area.has(tileOf(u).join(','))) continue;
      b.addBuff(u, { key: SHIELD, source: unit, duration: def.duration, visible: true, shield: def.shield });
    }
  };
  const cast = target => {
    unit.mem.allerdale.state = 'cast'; unit.mem.allerdale.target = target;
    b.after(def.hit, () => {
      if (!unit.alive || !live(target)) return;
      // trap_allady_t[stay] on the target: one trigger 1 s later puts the shield on the 3x3 around it.
      b.addBuff(target, { key: STAY, source: unit, duration: def.delay + 1e-6 });
      b.after(def.delay, () => { if (live(target)) shieldAround(target); }, { owner: target });
    }, { owner: unit });
    b.after(def.cast, die, { owner: unit });
  };
  // Its attack needs an ally on its own tile or the tile it faces (nearest first); until then it stands idle.
  const look = () => {
    if (!unit.alive || unit.mem.allerdale.state === 'cast') return;
    const target = allies().filter(u => reach.includes(tileOf(u).join(',')))
      .sort((x, y) => reach.indexOf(tileOf(x).join(',')) - reach.indexOf(tileOf(y).join(',')) || x.deploySeq - y.deploySeq)[0];
    if (target) cast(target); else b.after(POLL, look, { owner: unit });
  };
  b.after(def.start, () => { if (unit.alive) { unit.mem.allerdale.state = 'idle'; look(); } }, { owner: unit });
  return unit;
}
