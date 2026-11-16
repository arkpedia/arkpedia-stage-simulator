# Nova Knightclub and The Candle Knight Viviana

`enemy_1184_cadkgt` (Nova Knightclub Trainee), `enemy_1184_cadkgt_2` (Elite) and `enemy_1184_cadkgt_3` (The Candle Knight Viviana, both database levels) are admitted from their pinned CN prefabs (`battle/enm_pfb_8.ab`). Their prefabs are identical apart from positions and Viviana's extra kill log (`enemy_cadkgt_3_log`, a `log_killed` passive counted through `stageOutcomeCounter`). Their ordinary attack is a 2.2-range Arts projectile on the existing path.

**Glimmering Touch (`ChargeAttack`).** One skill wrapper (`_familyMask` 3, silenceable):
- **Timing:** cooldown 25 and initial cooldown 25 (Viviana 20 and 20). The trigger is the ordinary ally filter with `_targetMotion` 1: one ground ally in range.
- **Channel** (`_timeMode` 3):
  - `Skill_Start`, which plays the `Skill_Begin` animation (20 frames);
  - `Skill_Loop` for the skill's `duration` (7 s);
  - `Skill_End` (60 frames).
- **Burst:** at End's frame-20 `OnAttack` event, 8.333 s into the 9.667 s cast, `projectile_enemy_cadkgt_s` lands instantly on the target. It deals `atk_scale` × ATK Arts damage (2.5, Viviana 3) to every selectable ally in range `x-1`: the 13-tile diamond within two steps of the target's tile.
- **No invisibility while charging:** the cast holds `cadkgt_immune_invisible` (immune to Invisibility), so stage or ally invisibility does not hide the knight. `cadkgt_signal_buff` ends with the spell and leaves `cadkgt_signal_end_buff`, a stage signal; it has no combat effect here.

## Shared changes

- `server/sim/content/arkpedia-enemy-charged-burst.js`: the reusable `chargedTileBurst` kind. It takes phased channel clocks, a range radius, a grid shape centred on the target's tile, ground-only targeting, and self-visibility during the cast.
- The shared `skill:ChargeAttack` feature now dispatches to the Nova Knights too, beside the Withered Knight and the Hui-Ming 'Envy' pair. `x-1` joins the retained range-table entries.
- Original models are in `arkpedia-sd-assets` `c93b7735`.

**First stage made ready by enemy work:** `ISW-SP` (Fanatical Flames, an Integrated Strategies event stage) needed only these knights.

## Verification

`test/arkpedia-nova-knights.test.js`:
- all four levels admitted; refusal when the channel duration or the `x-1` grid change, and when Viviana's kill log is missing;
- the burst lands at the End event on every ally in the diamond, including its edges, and nowhere beyond;
- out-of-range and flying operators are never aimed at;
- the knight is visible only while charging; stun cancels an unreleased burst.

Existing Withered Knight, Hui-Ming and other `ChargeAttack` suites pass unchanged.

## Boundaries

- **Range.** The trigger's collider radius is 2, but the skill's `range_radius` and the record's attack range are 2.2, and the EN wiki says "within attack range". The radius used is 2.2.
- **Burst targets.** The burst's filter limits each selection to one target, but the ability text and the EN wiki both say every unit in the area is hit, and the burst is applied that way.
- **Immunity as self-reveal.** Immunity to Invisibility is applied as a reveal of the knight for the cast; the effect on targeting is the same.
- **Loop length.** As for the Ambushers: the skill's `duration`, through the packet's `_cooldownKey`.
