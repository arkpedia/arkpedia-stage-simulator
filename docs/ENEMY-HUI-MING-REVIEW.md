# Hui-Ming attribute account

The Hui-Ming (yin/yang) attribute is now one shared account, and twelve enemies are admitted through it: `enemy_1122_sphond`, `enemy_1122_sphond_2`, `enemy_1123_spsbr`, `enemy_1123_spsbr_2`, `enemy_1125_spshld`, `enemy_1125_spshld_2`, the 'Fury' pair `enemy_1129_spklr` and `enemy_1129_spklr_2`, the 'Stabby' archers `enemy_1124_spbow` and `enemy_1124_spbow_2`, and the 'Blindey' pair `enemy_1127_sptrkg` and `enemy_1127_sptrkg_2`.

## What the source says

- **The attribute is a buff.** A unit is yin while it holds `buff_yin` and yang while it holds `buff_yang`. Both are database buffs with infinite lifetime. Starting either one finishes the other and leaves a derived presentation marker: the plain marker on a first start, a transition marker when it replaced the opposite attribute.
- **The talent chooses once.** `buff_yinyang[init]` is an immediate buff. `yinyang.dynamic` 0 starts yin, 1 starts yang, anything else starts nothing. All twelve records use 1.
- **Two independent output scales.** `buff_yinyang[same]` and `buff_yinyang[diff]` are permanent talent buffs on the unit. On `ON_CALCULATE_DAMAGE` each checks that the damage source holds one attribute and the recipient holds the same, or the opposite, attribute, then applies `AtkScaleUp` from its own stripped blackboard: 0.6 for the same attribute and 1.4 for the opposite in every record. A recipient without an attribute is not scaled. The scale has no apply-way filter.
- **The Fury talent adds a third scale.** `enemy_spklr_t` is a permanent talent buff on the Fury pair. It multiplies output by `atkup.atk_scale` (1.8) when its owner and the recipient hold opposite attributes, on top of the 1.4, so 2.52 in total. It is carried as an optional `bonus` of the same runtime kind and stops when its own buff is removed.
- **'Stabby' prefers the opposite attribute.** Its attack is an ordinary direct ranged hit (no projectile) with radius 2.5 on ground and flying targets. Its selector lists two buff pairs, own yin with target yang and own yang with target yin, and sorts taunt last, so a candidate of the opposite attribute is chosen ahead of taunt and deployment order. The preference follows the archer's current attribute and disappears when it has none.
- **'Blindey' is blocked only by its own attribute.** The body's block condition admits a blocker only when both hold yin or both hold yang. While blocked, a checker buff on the blocker runs every tenth of a second, first after one interval, and releases the enemy when the blocker's attribute differs from the enemy's or the blocker has none.
- `buff_yinyang_switch` swaps an existing attribute and does nothing for a unit that has none.

## What was built

- Enemy target sorting accepts a live comparator owned by a component, used for the archer's attribute-following preference. The existing paired-block component accepts several native pairs whose markers it does not own, with the release decided by the compiled native checker and an optional one-interval first delay.

- `server/sim/content/arkpedia-hui-ming.js` is the shared account: `huiMingOf`, `setHuiMing`, `switchHuiMing`. It reads and writes the unit's own `buff_yin` / `buff_yang`, for any unit kind, so future Hui-Ming tiles, devices, operators and enemy skills use the same fact. No second store exists.
- The `huiMingAttribute` runtime kind is the talent: the start-only choice and the two scales, each tied to its own attached parent buff.
- The damage pipeline gained one opt-in event, `sourceAtkScale`. It scales the pre-mitigation amount for one source and recipient pair without rewriting a `DamageInfo` shared by an area attack. Nothing changes while no component listens. Sourceless packets skip it.
- The source gate checks the talent component and binding, all five templates and both database buffs exactly, plus each body's ordinary melee packet, single mode, absence of other abilities, skeleton identity and attack clock. The guard pair's separate taunt talent is checked as exactly one permanent blackboard taunt-level addition; its behaviour stays with the existing `talent:taunt` feature.

## Verification

Twenty-two family tests pass on raw and compiled records: start attribute and markers, 1.0 / 0.6 / 1.4 against a recipient with no, the same and the opposite attribute, independence of the two parent buffs, the three `dynamic` values, attribute replacement and switching, per-recipient isolation and refusals. The focused run with the Famiglia families, Father Agenir, the paired-block component, the compiler, runtime plans and top-level tests that import the damage pipeline passes 436 of 436. The broad simulator and content run measured 1,807 tests, 1,803 passes, three skips, one todo and no failures, and all 970 pinned stage graphs pass ten-second runtime smoke; all three were measured on the final code of this batch. The desktop and touch browser fixtures pass for all twelve records with a deployed operator: the scales, the archer's direct hit and installed preference, and same-attribute block admission and release, with selected loading and no source catalogue requests. All twelve original bodies decode 66 clips and render in both galleries. The Fury pair was added after the broad run; its change is confined to the Hui-Ming module, gate, registration and tests, and the focused run was repeated.

Coverage reaches 781 of 2,163 enemies, 847 database levels and 215 runtime kinds.

## Boundaries

- Operators only get an attribute in the fixtures because the test sets it. The Hui-Ming tiles and devices of the original stages are stages-phase work; no original stage is certified.
- `ON_CALCULATE_DAMAGE` is read as the damage source's event: the scale applies to damage the unit deals, not to damage it receives. That reading matches the templates' explicit source check but was not established from method bodies.
- The derived presentation marker is removed with its attribute buff. The native descriptor marks it derived without the finish-with-parent flag; which of the two governs was not established. It is presentation only.
- Nine further records with `talent:yinyang` remain unadmitted. Each needs something beyond the account: the 'Smarty' attribute-dependent death blasts, the 'Envy' charged attribute-shifting attack, the 'Free' boss, and `enemy_15008_dqspsb` and `enemy_15082_dqklr`, which carry extra `Trace` and `TargetSelector` components of another mode and were not gated.
- The archer's `Attack_Up` and `Attack_Down` clips for targets on other heights, its selector's abnormal-flag and secondary-filter values, and the 'Blindey' visual passive `sptrkg_passive[effect]` are gated but not reproduced.
- Effects, audio and frame/pixel parity are not reviewed.
