// SPDX-License-Identifier: GPL-3.0-or-later
// One interpretation of the live skill runtime for both the map and selected operator.
// Only explicitly bound owned summons expose an owner's skill controls. The
// token keeps its own combat runtime; this helper changes presentation only.
export function skillSourceFor(unit) {
  const owner = unit?.mem?.skillOwner;
  return owner && owner === unit.ownerUnit && owner.alive && owner.deployed
    ? owner : unit;
}

export function skillHud(skill) {
  if (!skill || skill.noSkill || skill.kind === "passive") return null;
  // On-deployment effects expose their active duration, not a fictional
  // recharge/ready gauge after their one deployment window has ended.
  if (skill.spec?.hideInactiveHud && !skill.active && !skill.pending) return null;
  const clamp = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  const ready = skill.ready && !skill.active && !skill.pending;
  const manual = skill.manual || skill.spec?.manualActivation?.() === true;
  const charged = !!(ready && skill.spec?.chargedState?.());
  const splitGauge = skill.active && typeof skill.spec?.overloadState === 'function';
  const overloaded = !!(splitGauge && skill.spec.overloadState());
  // A born sequence may precede the finite effect window. Its content clock
  // keeps the gauge full during startup without inventing extra effect seconds.
  const remaining = skill.spec?.durationRemaining?.() ?? skill.timeLeft;
  let fraction, text;
  if (skill.pending) {
    fraction = 1;
    text = "Skill ready · Next attack";
  } else if (skill.active) {
    fraction = skill.kind === "ammo"
      ? clamp(skill.ammoLeft / skill.ammoMax)
      : Number.isFinite(remaining)
        ? clamp(remaining / skill.duration)
        : 1;
    text = skill.kind === "ammo"
      ? `${skill.ammoLeft} ammo remaining`
      : Number.isFinite(remaining)
        ? `Skill active · ${Math.ceil(remaining)}s`
        : "Skill active";
    if (splitGauge) {
      fraction = clamp(fraction * 2 - (overloaded ? 0 : 1));
      if (overloaded) text = `Overload · ${text}`;
    }
  } else if (skill.exhausted) {
    fraction = 0;
    text = 'No skill uses remaining';
  } else {
    const cost = skill.spCost * skill.maxCharges;
    fraction = cost > 0 ? clamp(skill.spTotal / cost) : ready ? 1 : 0;
    text = `${Math.floor(skill.spTotal)} / ${cost} SP · ${skill.manual ? "Manual" : "Auto"} activation${ready ? " · Ready" : ""}`;
  }
  if (charged) text = `Charged · ${text}`;
  return {
    fraction,
    ...(charged ? { charged: true } : {}),
    state: overloaded ? 'overloaded' : skill.active || skill.pending || (ready && !skill.manual) ? "active" : "charging",
    // Automatic skills may explicitly permit a conditional manual action (Pepe S1).
    ready: !!(ready && manual),
    canActivate: !!(ready && manual && skill.castEligible !== false),
    canCancel: !!(skill.active && skill.spec?.manualCancel && skill.spec.canManualCancel?.() !== false),
    text,
  };
}
