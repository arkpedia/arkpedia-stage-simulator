# Hui-Ming attribute account

The Hui-Ming (yin/yang) attribute is now one shared account, and eight melee enemies are admitted through it: `enemy_1122_sphond`, `enemy_1122_sphond_2`, `enemy_1123_spsbr`, `enemy_1123_spsbr_2`, `enemy_1125_spshld`, `enemy_1125_spshld_2`, and the 'Fury' pair `enemy_1129_spklr` and `enemy_1129_spklr_2`.

## What the source says

- **The attribute is a buff.** A unit is yin while it holds `buff_yin` and yang while it holds `buff_yang`. Both are database buffs with infinite lifetime. Starting either one finishes the other and leaves a derived presentation marker: the plain marker on a first start, a transition marker when it replaced the opposite attribute.
- **The talent chooses once.** `buff_yinyang[init]` is an immediate buff. `yinyang.dynamic` 0 starts yin, 1 starts yang, anything else starts nothing. All eight records use 1.
- **Two independent output scales.** `buff_yinyang[same]` and `buff_yinyang[diff]` are permanent talent buffs on the unit. On `ON_CALCULATE_DAMAGE` each checks that the damage source holds one attribute and the recipient holds the same, or the opposite, attribute, then applies `AtkScaleUp` from its own stripped blackboard: 0.6 for the same attribute and 1.4 for the opposite in every record. A recipient without an attribute is not scaled. The scale has no apply-way filter.
- **The Fury talent adds a third scale.** `enemy_spklr_t` is a permanent talent buff on the Fury pair. It multiplies output by `atkup.atk_scale` (1.8) when its owner and the recipient hold opposite attributes, on top of the 1.4, so 2.52 in total. It is carried as an optional `bonus` of the same runtime kind and stops when its own buff is removed.
- `buff_yinyang_switch` swaps an existing attribute and does nothing for a unit that has none.

## What was built

- `server/sim/content/arkpedia-hui-ming.js` is the shared account: `huiMingOf`, `setHuiMing`, `switchHuiMing`. It reads and writes the unit's own `buff_yin` / `buff_yang`, for any unit kind, so future Hui-Ming tiles, devices, operators and enemy skills use the same fact. No second store exists.
- The `huiMingAttribute` runtime kind is the talent: the start-only choice and the two scales, each tied to its own attached parent buff.
- The damage pipeline gained one opt-in event, `sourceAtkScale`. It scales the pre-mitigation amount for one source and recipient pair without rewriting a `DamageInfo` shared by an area attack. Nothing changes while no component listens. Sourceless packets skip it.
- The source gate checks the talent component and binding, all five templates and both database buffs exactly, plus each body's ordinary melee packet, single mode, absence of other abilities, skeleton identity and attack clock. The guard pair's separate taunt talent is checked as exactly one permanent blackboard taunt-level addition; its behaviour stays with the existing `talent:taunt` feature.

## Verification

Seventeen family tests pass on raw and compiled records: start attribute and markers, 1.0 / 0.6 / 1.4 against a recipient with no, the same and the opposite attribute, independence of the two parent buffs, the three `dynamic` values, attribute replacement and switching, per-recipient isolation and refusals. The focused run with the Famiglia families, Father Agenir, the compiler and runtime plans passes 430 of 431, the one failure being the BI-EX-6 stage-file test already recorded as failing before these batches; the run includes top-level tests that import the damage pipeline directly. The broad simulator and content run measured 1,807 tests, 1,803 passes, three skips, one todo and no failures, and all 970 pinned stage graphs pass ten-second runtime smoke; both were measured before the final attribute-start reorder and taunt gate, which touch only the Hui-Ming module, its gate and its test. The desktop and touch browser fixtures pass for all eight records, blocked by a deployed operator, with selected loading of the account module and no source catalogue requests. All eight original bodies decode 42 clips and render in both galleries. The Fury pair was added after the broad run; its change is confined to the Hui-Ming module, gate, registration and tests, and the focused run was repeated.

Coverage reaches 777 of 2,163 enemies, 843 database levels and 215 runtime kinds.

## Boundaries

- Operators only get an attribute in the fixtures because the test sets it. The Hui-Ming tiles and devices of the original stages are stages-phase work; no original stage is certified.
- `ON_CALCULATE_DAMAGE` is read as the damage source's event: the scale applies to damage the unit deals, not to damage it receives. That reading matches the templates' explicit source check but was not established from method bodies.
- The derived presentation marker is removed with its attribute buff. The native descriptor marks it derived without the finish-with-parent flag; which of the two governs was not established. It is presentation only.
- Thirteen further records with `talent:yinyang` remain unadmitted. Each needs something beyond the account: opposite-attribute target priority (`enemy_1124_spbow`), attribute-restricted blocking, attribute-shifting attacks, the 'Free' boss, and `enemy_15008_dqspsb` and `enemy_15082_dqklr`, whose attack components sit in a triggered attack slot instead of the plain melee packet and were not gated.
- Effects, audio and frame/pixel parity are not reviewed.
