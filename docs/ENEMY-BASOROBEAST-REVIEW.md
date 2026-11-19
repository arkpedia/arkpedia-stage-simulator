# Basorobeast and Gravorobeast

Two Mountain Beast melee enemies with one shared mechanism: a weak spot on the rear.
- Basorobeast (`enemy_1307_mhrhcr`): 12,000 HP, 600 ATK, 140 DEF, 0 RES, attack interval 4, move speed 0.7, weight 2.
- Gravorobeast (`enemy_1307_mhrhcr_2`): 16,000 HP, 750 ATK, 160 DEF, 0 RES; otherwise the same.

Basorobeast alone blocked TG-7 "Moving Mountains" and its Challenge. Gravorobeast is in no published stage yet.

Both are admitted from their pinned CN prefabs (`battle/enm_pfb_12.ab`) and the Global buff templates. `shared/arkpedia/enemy-basorobeast-features.js` holds the contract. It pins:
- the record (stats, ability text, talents, no skills);
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the `enemy_mhrhcr_weakness` and `empty` templates;
- the Attack clip clock from `refs/arts/enm_art_12.ab`: 1.33 s, hit at 0.5 s.

The runtime is `server/sim/content/arkpedia-enemy-basorobeast.js`, kind `rearWeakness`.

## Weakness

`talent:Weakness` is the shared key of the Duck Lord and the Burdenbeast Supplier. `enemy-directional-features.js` dispatches `covers`, `ability`, `explains` and the native claim to this contract for both robeasts.

The talent installs `mhrhcr_weakness`, a permanent buff with the `enemy_mhrhcr_weakness` template. On every damage taken:
1. `CheckIfSourceGridPosFaceTargetGridPos`, FRONT, same column NONE: the source's column lies strictly on the side the beast faces.
2. `DamageScale`, one minus `damage_resistance` (0.8), Physical and Arts only, not stackable.

So Physical and Arts damage from the front is cut to 20%. Damage from the same column or from behind, True damage, and sourceless damage are not reduced. The scale uses the engine's conditional Sanctuary channel (`frontSourceSanctuary`, as the Supplier does), so with an ordinary Sanctuary only the stronger one applies.

The template's `ON_APPLIED_MODIFIER` branch only logs back hits (`criticaldamage`) for the event's statistics. It has no combat effect.

## Facing

The robeast has no facing ability of its own. The ordinary `FaceSwitcher` (default right) and the Combat ability (`_faceToTarget`) decide where it looks:
- **Spawn.** It faces its first horizontal route leg.
- **Walking.** It turns to each horizontal step. Vertical legs and waits keep the facing.
- **Attacking.** It turns to its target when an attack starts.

The facing is `e.mem.nativeFacing`, which also flips the sprite.

## WeaknessUI

`talent:WeaknessUI` is the HUD plugin `act24side_weakness_hud_plugin` and an `empty` `mh_direction_mark` buff. It is presentation only, pinned with the tree.

## Verification

`test/arkpedia-basorobeast.test.js`:
- **Admission.** Both variants are admitted. Each of these is refused:
  - a BACK face test;
  - a same-column hit counted as front;
  - an all-damage mask;
  - no one-minus;
  - no turn to the target;
  - a different `damage_resistance`.
- **Damage.** From a column ahead, 1,000 Arts deals 200 and Physical deals (1,000 − DEF) × 0.2. The same column, behind, True and sourceless deal the full amount. Facing left mirrors it. With an ordinary 50% Sanctuary, a front hit deals 200 and a rear hit 500.
- **Walking.** On the harness route the robeast faces left before its first step and turns only with horizontal steps. When the guard blocks it, the guard's hits are cut to a fifth.
- **Blocked.** It turns to the blocker on its right when it attacks.
- **Compiled TG-7 and its Challenge.** Basorobeast at 12,000 HP / 600 ATK, and 14,400 / 720 in the Challenge, carries the front guard. No battle errors.

The library rebuild published TG-7 and TG-7 Challenge (1,022 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,022 graphs with no failures. The browser review passed, and both stages load in the preview with no console errors.

## Boundaries

- **Turn timing.** The FaceSwitcher's 0.15 s `_switchTime` is read as the sprite's flip animation. The logical facing turns at once.
- **Displacement.** Whether a sideways push or pull turns it is unchecked. The runtime turns it on horizontal steps taken while it is walking (`e.moving`).
- **Log talent.** `LogKilled` (`log_killed`, a kill counter) is an auxiliary component with no combat effect.
- **Presentation.** The front-hit spark and sound are not reproduced.
