// SPDX-License-Identifier: GPL-3.0-or-later
// Heart Candle's source prefab has EmptyAnimator, not a Spine actor. This
// deliberately simple marker is a placeholder until native effects are ported.
export class HeartCandleActor {
  constructor(PIXI) {
    this.spine = new PIXI.Graphics();
    this.gaugeHeight = 160;
    this.spine.lineStyle(5, 0xb9536d, .9)
      .beginFill(0x2c172a, .9)
      .drawRoundedRect(-35, -105, 70, 100, 10).endFill()
      .lineStyle(0).beginFill(0xf7a1a7)
      .drawPolygon([0, -160, 22, -124, 0, -108, -22, -124]).endFill();
  }
  deploy() {}
  die() {}
  setBase() {}
  setSkill() {}
  setRegularSkin() {}
  setRegularVisual() {}
  update() {}
  destroy() { this.spine.destroy(); }
}
