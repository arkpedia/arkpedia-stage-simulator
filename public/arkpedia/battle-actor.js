// SPDX-License-Identifier: GPL-3.0-or-later
import { SpineActor } from "../js/render/spine.js";

export class BattleActor extends SpineActor {
  constructor(skeleton, entry) {
    super(skeleton, entry);
    // Each combat event plays one strike, then rests until the next attack.
    this.clipPerAttack = true;
  }

  setSkill(on) {
    // The asset importer marks skills without their own clips as `via: attack`.
    // A stat buff must not start a sword-swing loop without a combat attack.
    super.setSkill(on && this.roles.skill?.via !== "attack");
  }
}
