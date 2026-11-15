// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage force integration. See docs/DISPLACEMENT-REVIEW.md for the
// PRTS/AUE research, frame ordering, and remaining collision limitations.
import { TICK, PULL_STOP_RADIUS } from './constants.js';

const speeds = [1, 2, 4, 4.5, 5.3, 5.8];
const forces = [2, 10, 40, 42, 44, 46];
const friction = 4.905;
const entry = (table, level) => level <= -3 ? 0 : table[Math.min(5, Math.max(0, Math.floor(level) + 2))];
const staticBody = e => !!(e.def?.staticBody || e.s.flags.staticBody);
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);

export class RegularDisplacement {
  constructor(battle) {
    this.b = battle;
    battle.on('death', ({ unit }) => {
      if (unit.mem.regularShift) this.finish(unit, unit.mem.regularShift);
    }, { priority: 1000 });
    battle.on('enemyHidden', ({ enemy, hidden }) => {
      if (hidden && enemy.mem.regularShift) this.finish(enemy, enemy.mem.regularShift);
    }, { priority: 1000 });
  }

  canForce(e) {
    return !!(e?.alive && e.deployed && !e.hidden && e.side === 'enemy' && !e.isBoss
      && !e.s.flags.noDisplace && (!e.isFlying || staticBody(e)));
  }

  begin(e, state) {
    e.mem.regularShift = state;
    e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
    e.actionControlEpoch = (e.actionControlEpoch ?? 0) + 1;
    this.b._unblock(e);
    e.moving = false;
    e.atkStandUntil = -Infinity;
    if (e.route) e.route.pts = null;
    this.b.emit('enemyUnbalanced', { enemy: e });
    return state;
  }

  // Called after Battle.push has applied the shared directional force rules.
  // Return acceptance, not a prediction of travel. Position-dependent effects
  // use onTravel/onCollision, while damage-by-distance keeps enemyDisplaced.
  push(e, level, direction, options = {}) {
    const speed = entry(speeds, level);
    if (!this.canForce(e) || !speed) return false;
    const old = e.mem.regularShift;
    const state = this.begin(e, { vx: (old?.vx ?? 0) + direction.x * speed,
      vy: (old?.vy ?? 0) + direction.y * speed, hard: .1, options,
      stop: options.inward && finitePoint(options.from)
        ? { x: options.from.x, y: options.from.y, radius: PULL_STOP_RADIUS } : null });
    if (staticBody(e)) { state.vx = state.vy = state.hard = 0; }
    else if (!options.effect) this.move(e, state, TICK);
    return true;
  }

  pull(e, force, { to, center = null, stop = PULL_STOP_RADIUS } = {}) {
    if (!this.canForce(e) || !finitePoint(to)) return false;
    const level = this.b.forceLevel(e, force), strength = entry(forces, level);
    const distance = Math.hypot(to.x - e.x, to.y - e.y);
    if (!strength || distance < 1e-9) return false;
    const old = e.mem.regularShift;
    this.begin(e, { vx: old?.vx ?? 0, vy: old?.vy ?? 0, hard: .1, options: {},
      pull: { x: to.x, y: to.y, distance, strength, left: level < -1 ? .5 : 1, stopped: false },
      stop: { x: finitePoint(center) ? center.x : to.x, y: finitePoint(center) ? center.y : to.y,
        radius: Number.isFinite(stop) ? Math.max(0, stop) : PULL_STOP_RADIUS } });
    return true;
  }

  finish(e, state) {
    if (e.mem.regularShift !== state) return;
    delete e.mem.regularShift;
    if (e.route) e.route.pts = null;
    this.b.emit('enemyBalanced', { enemy: e });
  }

  // Clip a segment at the stop circle, including a fast step that would cross
  // and leave the circle in one frame. No snapping past a wall or a hole.
  clip(e, state, ux, uy, distance) {
    const stop = state.stop;
    if (!stop) return distance;
    const x = e.x - stop.x, y = e.y - stop.y, square = x * x + y * y - stop.radius ** 2;
    if (square <= 1e-9) return 0;
    const along = x * ux + y * uy, disc = along * along - square;
    if (disc >= 0) {
      const first = -along - Math.sqrt(disc);
      if (first >= 0) return Math.min(distance, first);
    }
    return distance;
  }

  move(e, state, dt) {
    const speed = Math.hypot(state.vx, state.vy);
    if (speed <= 1e-9) return;
    const ux = state.vx / speed, uy = state.vy / speed;
    const requested = speed * dt, distance = this.clip(e, state, ux, uy, requested);
    const from = { x: e.x, y: e.y };
    const moved = this.b.displace(e, { x: ux, y: uy }, distance, { onFall: state.options.onFall });
    const to = { x: e.x, y: e.y };
    if (moved > 0 && state.options.onTravel) this.b._safe(() => state.options.onTravel({ enemy: e, from, to, distance: moved }), 'shift.onTravel', e);
    if (!e.alive || e.hidden || Math.hypot(to.x - from.x - ux * moved, to.y - from.y - uy * moved) > 1e-6) {
      this.finish(e, state); return;
    }
    if (moved + 1e-9 < distance) {
      state.vx = state.vy = 0;
      const row = Math.round(e.y + uy * .1), col = Math.round(e.x + ux * .1);
      const tile = this.b.grid.inRect(row, col) ? this.b.grid.tile(row, col) : null;
      if (state.options.onCollision) this.b._safe(() => state.options.onCollision({ enemy: e, tile, row, col }), 'shift.onCollision', e);
    } else if (distance + 1e-9 < requested) {
      state.vx = state.vy = 0;
      if (state.pull) state.pull.stopped = true;
    }
  }

  // Invoked once in the enemy phase. Even the settling frame owns movement;
  // route walking, blocking and ordinary attacks resume on the following frame.
  update(e, dt) {
    const state = e.mem.regularShift;
    if (!state) return false;
    if (!this.canForce(e) || e.s.flags.levitate) { this.finish(e, state); return false; }
    const pull = state.pull;
    state.hard = Math.max(0, state.hard - dt);
    if (staticBody(e)) {
      state.vx = state.vy = 0;
      if (pull) pull.left = Math.max(0, pull.left - dt);
      if (!pull || pull.left < 1e-9) this.finish(e, state);
      return true;
    }
    const speed = Math.hypot(state.vx, state.vy), ratio = speed > 0 ? Math.max(0, speed - friction * dt) / speed : 0;
    state.vx *= ratio; state.vy *= ratio;
    if (pull?.left > 1e-9) {
      const stop = state.stop;
      if (pull.stopped || Math.hypot(e.x - stop.x, e.y - stop.y) <= stop.radius + 1e-9) {
        pull.stopped = true; state.vx = state.vy = 0;
      } else {
        const dx = pull.x - e.x, dy = pull.y - e.y, distance = Math.hypot(dx, dy);
        if (distance > 1e-9) {
          const delta = pull.strength * (distance / pull.distance) ** 4 * dt;
          state.vx += dx / distance * delta; state.vy += dy / distance * delta;
        }
      }
      pull.left = Math.max(0, pull.left - dt);
    }
    this.move(e, state, dt);
    if (Math.hypot(state.vx, state.vy) <= .1 && state.hard < 1e-9 && !(pull?.left > 1e-9)) this.finish(e, state);
    return true;
  }
}
