// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal battlefield marker for records whose chibi skeleton is absent from the SD snapshot.
// Keeps the simulation playable while the original artwork streams in (or stays unavailable).
const P = globalThis.PIXI;

export class FallbackActor {
  constructor(unit) {
    this.spine = new P.Container();
    this.spine.sortableChildren = true;
    this.body = new P.Graphics();
    this.spine.addChild(this.body);
    this.setSide(unit.side);
    this.gaugeHeight = 38;
    this.mode = 'idle';
  }
  setSide(side) {
    if (this.side === side) return;
    this.side = side;
    const enemy = side === 'enemy', body = this.body;
    const color = side === 'neutral' ? 0xd1c58c : enemy ? 0xd16a6a : 0x63c7ef;
    const dark = side === 'neutral' ? 0x655d3c : enemy ? 0x6e2d2d : 0x235c73;
    body.clear();
    body.beginFill(dark, 0.95).lineStyle(22, color, 1).drawCircle(0, 0, 240).endFill();
    body.beginFill(color, 0.85).drawCircle(0, 0, 170).endFill();
  }
  deploy() {}
  update() {}
  die() {}
  setBase() {}
  setSkill() {}
  setRegularSkin() {}
  setRegularVisual() {}
  destroy() { this.spine.destroy({ children: true }); }
}
