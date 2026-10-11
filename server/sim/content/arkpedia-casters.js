// SPDX-License-Identifier: GPL-3.0-or-later
// Source: Global game tables at 57010cb5b2afea112cae57daa756b58676ba6850.
// Original Android client 26-09-23-17-49-43_b9cc4a charpack checksums:
// Haze 1ccaed7fde488d852ec6c2f77bb09257; Gitano 76347092b59fdd986b604542862b2a01;
// Greyy 23e5bd053ba587da05ba86dddeec40e5. Skill prefabs were checked in [uc]skills.ab.

/** Customize before _setupUnit; installCaster runs afterwards, before _deploy. */
export function customizeCasterKit({ id, def, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === "char_141_nights" && skill.id === "skchr_nights_2") {
    // The prefab uses ordinary stat modifiers, preserving current HP percentage
    // when max HP changes; it does not inflict a separate 75% current-HP loss.
    kit.skill.mods = { atkPct: bb.atk, aspd: bb.attack_speed, hpPct: bb.max_hp };
    kit.skill.attack = { dmgType: "arts" };
  }
  if (id === "char_109_fmout" && skill.id === "skchr_fmout_2") {
    // Destiny's client selector has no target limit and uses the expanded range.
    // It deals direct damage once to each target, rather than overlapping splash.
    kit.skill.targeting = { rangeGrid: skill.rangeGrid, allInRange: true };
    kit.skill.attack = { dmgType: "arts", splashRadius: 0, projectile: "none" };
    kit.skill.onEnd = ({ battle, unit, reason }) => {
      if (unit.alive && reason === "duration")
        battle.applyStatus(unit, "stun", { duration: bb.time, source: unit });
    };
  }
  if (id === "char_253_greyy" && skill.id === "skchr_greyy_2") {
    // An explicit attack override retains the skill flag on projectiles in flight,
    // so their enhanced Slow still lands if the skill ends before impact.
    kit.skill.attack = { dmgType: "arts" };
  }
}

/** Talent hooks and ordinary attack geometry; ownership cleans hooks on retreat. */
export function installCaster({ battle, unit, def }) {
  const id = unit.defId;
  const talent = def.talents[0]?.bb;
  if (id === "char_141_nights" && talent) {
    // nights_t_1 is an additive active attack buff, RES MUL_FINAL, one stack.
    // Attach before damage is calculated so the hit itself uses reduced RES.
    battle.on("hit", ({ source, target, dmg }) => {
      if (source !== unit || !dmg.isAttack || target.side === unit.side) return;
      battle.addBuff(target, {
        key: "haze:res", duration: talent.duration, refresh: "replace", source: unit,
        mods: { resMul: 1 + talent.magic_resistance },
      });
    }, { owner: unit });
  }
  if (id === "char_109_fmout") {
    // Base attack's client Selector CircleCollider2D radius is 1.10000002384.
    unit.profile.splashRadius = 1.1;
    if (talent) {
      const choices = [
        ["aspd", talent.attack_speed], ["atkPct", talent.atk], ["hpPct", talent.max_hp],
      ];
      const [key, value] = choices[Math.floor(battle.rng() * choices.length)];
      unit.mem.divination = key;
      battle.addBuff(unit, {
        key: "gitano:divination", mods: { [key]: value }, source: unit,
        persist: true, allowDead: true,
      });
    }
  }
  if (id === "char_253_greyy") {
    // projectile_greyy's Range CircleCollider2D is radius 1.0. His character's
    // 1.1 search collider is not the projectile damage radius.
    unit.profile.splashRadius = 1;
    if (talent) {
      unit.profile.onEachHit = (b, u, target, hit) => {
        if (!target.alive) return;
        const scale = hit.isSkill && def.skill.id === "skchr_greyy_2"
          ? def.skill.bb.talent_scale : 1;
        b.applyStatus(target, "sluggish", {
          duration: talent.sluggish * scale, source: u,
        });
      };
    }
  }
}
