// SPDX-License-Identifier: GPL-3.0-or-later
// An empty overlay anchor: artwork is rendered by the native Three.js pass.
// This supplies only the common HUD actor interface, never a substitute sprite.
export class EffectOnlyActor {
  constructor(PIXI,{gaugeHeight}) {
    if(!Number.isFinite(gaugeHeight)||gaugeHeight<0)throw Error('Invalid effect-only gauge height');
    this.spine=new PIXI.Container();this.gaugeHeight=gaugeHeight;
  }
  deploy() {}
  die() {}
  attack() {}
  setBase() {}
  setSkill() {}
  setRegularSkin() {}
  setRegularVisual() {}
  update() {}
  destroy(){this.spine.destroy();}
}
