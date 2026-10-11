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
    this.baseRoles = this.roles;
    // Each combat event plays one strike, then rests until the next attack.
    this.clipPerAttack = true;
    this.attackDrivenSkill = attackDrivenSkill;
    this.attackVisualRole = null;
    this.regularVisualKey = null;
    // Some source headers include distant effect attachments (Noir Corne's
    // height exceeds 2,000 units). Measure the original resting pose once for
    // a stable gauge anchor rather than following attacks or that header box.
    this.spine.update(0);
    const resting = this.spine.getLocalBounds?.();
    this.gaugeHeight = resting?.height > 0 && Number.isFinite(resting.y) && resting.y < 0
      ? -resting.y : entry.bounds?.height || 380;
  }

  setRegularSkin(name) {
    // Reviewed prefab skin holders resolve to literal names in this skeleton.
    // Change instance attachments only; preserve shared data and animation time.
    if (name == null && this.regularSkinName === undefined) return false;
    const skeleton = this.spine.skeleton;
    if (!this.regularBaseSkin) this.regularBaseSkin = skeleton.skin ?? skeleton.data?.defaultSkin;
    const desired = name == null ? this.regularBaseSkin : skeleton.data?.findSkin?.(name);
    if (!desired || this.regularSkinName === desired.name) return false;
    skeleton.setSkin(desired);
    skeleton.setSlotsToSetupPose();
    this.spine.state.apply(skeleton);
    this.regularSkinName = desired.name;
    return true;
  }

  setRegularVisual(visual) {
    const speed = Number.isFinite(visual?.speed) && visual.speed > 0 ? visual.speed : 1;
    const key = visual ? `${visual.clip}|${!!visual.loop}|${visual.attack || ''}|${visual.die || ''}|${speed}` : null;
    if (key === this.regularVisualKey) return;
    this.regularVisualKey = key;
    this.regularVisualClip = visual?.clip ?? null;
    this.regularVisualSpeed = speed;
    if (!visual) { this.setForm(null); return; }
    // Literal clip names come only from reviewed original-prefab presentation.
    // Missing clips never borrow another operator's form or manufacture a pose.
    const roles = visual.loop ? {
      idle: this.has(visual.clip) ? visual.clip : this.baseRoles.idle,
      ...(this.has(visual.attack) ? { attack: { loop: visual.attack } } : {}),
      ...(this.has(visual.die) ? { die: visual.die } : {}),
      skill: null,
    } : {
      ...(this.has(visual.die) ? { die: visual.die } : {}),
      skill: null,
    };
    this.setForm(roles, !visual.loop && this.has(visual.clip) ? visual.clip : null);
    if (!visual.loop && this.mode === 'change' && this.current === visual.clip)
      this.changeUntil = this.clock + this.dur(visual.clip) / speed;
  }

  _play(name, loop, options = {}) {
    // Apply only the literal reviewed form clip's alias speed. Explicit
    // attack windup timing, other clips and other actors retain their rates.
    return super._play(name, loop, { ...options, timeScale: options.timeScale
      ?? (name === this.regularVisualClip ? this.regularVisualSpeed ?? 1 : 1) });
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
    if (role && typeof role === 'object' && this.has(role.loop)) return role;
    if (role === 'attack' && this.has(this.roles.attack?.loop)) return this.roles.attack;
    if (role === 'skill' && this.has(this.roles.skill?.loop)) return this.roles.skill;
    if (role !== 'attack' && role !== 'skill' && this.has(role)) return { loop: role };
    return super._attackClip();
  }

  attack(interval, once = false, visual = null) {
    // Original animation-free mode attacks keep their separately running stance
    // (for example Grain Buds' singing loop) while the timed projectile fires.
    // This is explicit source metadata; ordinary attacks retain their clips.
    if (visual?.animation === 'none') return;
    if (this.attackBeginPending) return;
    this.attackVisualRole = visual?.animation ?? null;
    const clip = this._attackClip();
    if (visual?.windup > 0 && typeof visual.animation === 'object' && this.has(clip?.begin)
      && this.has(clip.loop) && !this.dead && !['stun', 'die', 'change'].includes(this.mode)) {
      // A reviewed source engagement can contain a one-time preparatory clip.
      // Its own duration precedes the strike clip; later attacks use only loop.
      const naturalDuration = this.dur(clip.begin);
      const duration = Number.isFinite(clip.beginDuration) && clip.beginDuration > 0
        ? clip.beginDuration : naturalDuration;
      if (duration > 0 && visual.windup >= duration) {
        this.mode = 'attackBegin';
        this._play(clip.begin, false, { mix: .06, timeScale: naturalDuration / duration });
        this.attackBeginPending = { until: this.clock + duration, interval, once,
          windup: visual.windup - duration };
        return;
      }
    }
    if (Number.isFinite(visual?.windup) && visual.windup > 0) {
      // The regular-stage event starts the attack; damage is released at the
      // source hit frame later. Multiple targets share one animation.
      if (this.mode === 'attack' && this.wound && this.current === this._attackClip()?.loop) return;
      if (super.windUp(interval, visual.windup, once)) return;
    }
    super.attack(interval, once);
  }

  update(dt) {
    const pending = this.attackBeginPending;
    super.update(dt);
    if (pending && this.mode !== 'attackBegin') this.attackBeginPending = null;
    else if (pending && this.clock + 1e-9 >= pending.until) {
      this.attackBeginPending = null;
      this.mode = 'base';
      // Carry a large frame's overshoot into the literal strike clip, preserving
      // the original begin + hit deadline instead of adding a rendered frame.
      const elapsed = this.clock - pending.until;
      if (!super.windUp(pending.interval, pending.windup, pending.once)) super.attack(pending.interval, pending.once);
      const track = this.spine.state.tracks[0];
      if (track) track.trackTime += elapsed * track.timeScale;
      if (this.windUntil != null) this.windUntil -= elapsed;
      this.attackUntil -= elapsed;
    }
    if (this.mode !== 'attack' && this.mode !== 'attackBegin') this.attackVisualRole = null;
  }
}
