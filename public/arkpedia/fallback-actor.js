// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal battlefield marker for records whose chibi skeleton is absent from the SD snapshot.
// Keeps the simulation playable while the original artwork streams in (or stays unavailable).
const P = globalThis.PIXI;

export class FallbackActor {
  constructor(unit) {
    const enemy = unit.side === 'enemy';
    this.spine = new P.Container();
    this.spine.sortableChildren = true;
    const color = enemy ? 0xd16a6a : 0x63c7ef;
    const dark = enemy ? 0x6e2d2d : 0x235c73;
    const body = new P.Graphics();
    body.beginFill(dark, 0.95).lineStyle(2, color, 1).drawCircle(0, 0, 20).endFill();
    body.beginFill(color, 0.85).drawCircle(0, 0, 13).endFill();
    this.spine.addChild(body);
    const initial = new P.Text(unit.name?.trim().slice(0, 2) || (enemy ? 'E' : 'OP'), {
      fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '700', fill: 0xf4fbfa,
      align: 'center',
    });
    initial.anchor.set(0.5);
    initial.y = -1;
    this.spine.addChild(initial);
    this.gaugeHeight = 38;
    this.mode = 'idle';
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
