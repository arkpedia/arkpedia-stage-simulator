// SPDX-License-Identifier: GPL-3.0-or-later
import { SpineActor } from "../js/render/spine.js";

export class BattleActor extends SpineActor {
  constructor(skeleton, entry, skillIndex = null, { attackDrivenSkill = false } = {}) {
    super(skeleton, entry);
    // Each actor selects its build's skill without changing the shared model.
    if (skillIndex !== null) this.roles = { ...this.roles,
      skill: this.roles.skills?.[String(skillIndex)]
        ?? (this.roles.skill?.index === skillIndex ? this.roles.skill : null),
    };
    // Each combat event plays one strike, then rests until the next attack.
    this.clipPerAttack = true;
    this.attackDrivenSkill = attackDrivenSkill;
    this.attackVisualRole = null;
  }

  setSkill(on) {
    // Some skills choose a normal or skill strike only after selecting a target
    // (Ambriel S2). Switching the stance on must not fire a targetless skill shot.
    if (this.attackDrivenSkill && !this.roles.skill?.begin && !this.roles.skill?.idle) {
      this.skillOn = !!on;
      return;
    }
    // The asset importer marks skills without their own clips as `via: attack`.
    // A stat buff must not start a sword-swing loop without a combat attack.
    super.setSkill(on && this.roles.skill?.via !== "attack");
  }

  _attackClip() {
    const role = this.attackVisualRole;
    if (role === 'attack' && this.has(this.roles.attack?.loop)) return this.roles.attack;
    if (role === 'skill' && this.has(this.roles.skill?.loop)) return this.roles.skill;
    return super._attackClip();
  }

  attack(interval, once = false, visual = null) {
    this.attackVisualRole = visual?.animation ?? null;
    if (Number.isFinite(visual?.windup) && visual.windup > 0) {
      // The regular-stage event starts the attack; damage is released at the
      // source hit frame later. Multiple targets share one animation.
      if (this.mode === 'attack' && this.wound && this.current === this._attackClip()?.loop) return;
      if (super.windUp(interval, visual.windup, once)) return;
    }
    super.attack(interval, once);
  }

  update(dt) {
    super.update(dt);
    if (this.mode !== 'attack') this.attackVisualRole = null;
  }
}
