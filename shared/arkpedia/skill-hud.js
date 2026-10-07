// SPDX-License-Identifier: GPL-3.0-or-later
// One interpretation of the live skill runtime for both the map and selected operator.
export function skillHud(skill) {
  if (!skill || skill.noSkill || skill.kind === "passive") return null;
  const clamp = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  const ready = skill.ready && !skill.active && !skill.pending;
  let fraction, text;
  if (skill.pending) {
    fraction = 1;
    text = "Skill ready · Next attack";
  } else if (skill.active) {
    fraction = skill.kind === "ammo"
      ? clamp(skill.ammoLeft / skill.ammoMax)
      : Number.isFinite(skill.timeLeft)
        ? clamp(skill.timeLeft / skill.duration)
        : 1;
    text = skill.kind === "ammo"
      ? `${skill.ammoLeft} ammo remaining`
      : Number.isFinite(skill.timeLeft)
        ? `Skill active · ${Math.ceil(skill.timeLeft)}s`
        : "Skill active";
  } else if (skill.exhausted) {
    fraction = 0;
    text = 'No skill uses remaining';
  } else {
    const cost = skill.spCost * skill.maxCharges;
    fraction = cost > 0 ? clamp(skill.spTotal / cost) : ready ? 1 : 0;
    text = `${Math.floor(skill.spTotal)} / ${cost} SP · ${skill.manual ? "Manual" : "Auto"} activation${ready ? " · Ready" : ""}`;
  }
  return {
    fraction,
    state: skill.active || skill.pending || (ready && !skill.manual) ? "active" : "charging",
    // Automatic skills trigger themselves; the diamond invites a manual action only.
    ready: !!(ready && skill.manual),
    canActivate: !!(ready && skill.manual && skill.castEligible !== false),
    text,
  };
}
