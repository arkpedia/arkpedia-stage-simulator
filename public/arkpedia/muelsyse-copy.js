// SPDX-License-Identifier: GPL-3.0-or-later
// Input adapter for the source-owned copy window. It never deploys the donor.
import { canDeployInViewport } from '../../shared/arkpedia/squad.js';

export function flowingShapeDeck(entry) {
  return entry?.ownerId === 'char_249_mlyss' && entry.record?.id === 'token_10030_mlyss_wtrman'
    && entry.deck?.record === entry.record ? entry.deck : null;
}

export class FlowingShapeCopyInteraction {
  static open(entry) {
    const deck = flowingShapeDeck(entry), unit = entry?.unit;
    if (!deck || deck.b.finished || !unit || !deck.beginCopy(unit)) return null;
    const point = deck.tokens.get(unit);
    if (!point || !deck.valid(point) || !point.selecting || deck.copying !== point || !unit.skill.active) return null;
    return new FlowingShapeCopyInteraction(deck, unit);
  }
  constructor(deck, unit) {
    this.deck = deck; this.unit = unit; this.point = deck.tokens.get(unit);
    this.seq = unit.deploySeq; this.generation = this.point.generation;
    this.activation = unit.skill.activations; this.donorId = null;
    this.closed = false; this.confirming = false;
  }
  get current() {
    const { deck, unit, point } = this;
    return !this.closed && !deck.b.finished
      && deck.valid(point) && deck.tokens.get(unit) === point
      && unit.deploySeq === this.seq && point.generation === this.generation
      && unit.skill.activations === this.activation && unit.skill.active
      && point.selecting && deck.copying === point;
  }
  get active() { return this.current && canDeployInViewport(this.deck.b.viewport); }
  get donorIds() { return this.active ? this.deck.donorIds() : []; }
  choose(id) {
    if (!this.active || !this.donorIds.includes(id)) throw Error('Choose an undeployed operator from this squad.');
    this.donorId = id;
    return { kind: 'copy', donorId: id, row: this.unit.tileR, col: this.unit.tileC, dir: null };
  }
  get rangeGrid() {
    return this.active && this.donorId && this.donorIds.includes(this.donorId)
      ? this.deck.b.data.getChess(this.donorId).rangeGrid.map(cell => [...cell]) : [];
  }
  confirm(dir) {
    if (!this.active || this.confirming || !this.donorIds.includes(this.donorId))
      throw Error('The copy selection is no longer available.');
    if (!['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(dir)) throw Error('Choose a copy facing.');
    this.confirming = true;
    try {
      const accepted = this.deck.copyFrom(this.unit, this.donorId, dir);
      if (accepted) this.closed = true;
      return accepted;
    } finally { this.confirming = false; }
  }
  cancel() {
    const current = this.current;
    this.closed = true;
    if (current && !this.confirming) this.unit.skill.end('copy-cancel');
  }
}
