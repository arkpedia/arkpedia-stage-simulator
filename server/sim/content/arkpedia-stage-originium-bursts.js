// SPDX-License-Identifier: GPL-3.0-or-later
// Originium crystal bursts (shared/arkpedia/stage-originium-bursts.js): every `interval` s a crystal appears on one of
// the rule's tiles, bursts `delay` s later for `damage` Arts damage to the ally side on that tile and the eight around
// it, and, if nothing of the ally side stands on the tile, seals it for `life` s (Sealed Ground: no deployment).
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export class StageOriginiumBursts {
  constructor(b, rule) {
    if (!(rule?.tiles?.length && rule.interval > 0 && rule.delay >= 0 && rule.life > 0 && rule.damage > 0)) throw Error('Invalid Originium burst rule');
    this.battle = b; this.rule = rule; this.weights = rule.tiles.map(t => t.weight);
    this.nextAt = rule.interval; this.pending = []; this.sealed = []; this.bursts = 0; this.picks = [];
    b.on('tick', () => this.tick());
  }
  /** Crystals waiting to burst and tiles sealed now, for the client. */
  get markers() { return { warning: this.pending.map(p => [p.row, p.col]), sealed: this.sealed.map(s => [s.row, s.col]) }; }
  pick() {
    const b = this.battle, total = this.weights.reduce((n, w) => n + Math.max(0, w), 0);
    let i = 0;
    if (total > 0) { let x = b.rng() * total; for (i = 0; i < this.weights.length - 1; i++) { x -= Math.max(0, this.weights[i]); if (x < 0) break; } }
    else { this.weights = this.rule.tiles.map(t => t.weight); i = Math.floor(b.rng() * this.weights.length) % this.weights.length; }
    this.weights[i] += this.rule.addWeight; // the drawn tile is less likely next time [inference]
    return i;
  }
  burst({ row, col }) {
    const b = this.battle, key = `${row},${col}`, tiles = new Set(this.rule.range.map(([r, c]) => `${row + r},${col + c}`));
    const at = u => `${Math.round(u.tileR ?? u.y)},${Math.round(u.tileC ?? u.x)}`;
    const allies = b.allies(null, { includeTargetableDevices: true }).filter(live);
    const occupied = allies.some(u => at(u) === key);
    for (const u of allies) if (tiles.has(at(u)))
      b.dealDamage(null, u, { amount: this.rule.damage, type: 'arts', applyWay: 'none', tags: ['stage:originiumBurst'] });
    b.fx?.('explode', { x: col, y: row, r: 1.5, kind: 'arts' });
    this.bursts += 1;
    b.noDeployTiles ??= new Set();
    if (!occupied && !b.noDeployTiles.has(key)) { b.noDeployTiles.add(key); this.sealed.push({ row, col, key, until: b.time + this.rule.life }); }
  }
  tick() {
    const b = this.battle;
    if (b.finished) return;
    for (const s of this.sealed.splice(0)) if (b.time + 1e-9 >= s.until) b.noDeployTiles?.delete(s.key); else this.sealed.push(s);
    for (const p of this.pending.splice(0)) if (b.time + 1e-9 >= p.at) this.burst(p); else this.pending.push(p);
    if (b.time + 1e-9 < this.nextAt) return;
    this.nextAt += this.rule.interval;
    const t = this.rule.tiles[this.pick()];
    this.picks.push(`${t.row},${t.col}`);
    this.pending.push({ row: t.row, col: t.col, at: b.time + this.rule.delay });
    b.fx?.('telegraph', { x: t.col, y: t.row, r: 1.5, dur: this.rule.delay, kind: 'originiumBurst' });
  }
}
