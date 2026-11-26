# 14-20, the enemy sign and a weaker Sanctuary

14-20 "Procession of Kings" needed three things:
- **Logos's module** on the preset Logos (`docs/STAGE-14-11-REVIEW.md`), here with skill 3.
- **The stage environment** `mainline14_enemy_sign_effect`.
- **A stage value** for Duq'arael's second form: `HpAura.damage_resistance` 0.3.

This batch publishes 14-20, its adverse variant and H14-4's adverse variant, which uses the same environment (1,181 available; main story 449 of 564).

## The enemy sign environment

`tools/arkpedia/extract-stage-environments.py` now retains the prefab and its template in `data/arkpedia-environment-native-source.json`. `shared/arkpedia/stage-environments.js` (`enemySignNativeReviewed`) reviews it as presentation only:
- **Holder:** the generic global-buff holder (the same script as `periodic_damage`), targeting enemies. Its one buff, `[g]mainline14_enemy_sign_effect`, has no attributes, flags or trigger.
- **Template:** one event, `ON_BUFF_START`. It creates `mainline14_enemy_sign_effect[core]` on the owner: template `empty`, no attributes, held for life, effect `enemy_common_sign_01`.
- **Who gets it:** with `filter_id` above 0, only nine listed enemies (Patriot, the four `wdslm` forms, both forms of Duq'arael, `demonk` and `sotisd`). Otherwise every enemy.
- **Effect:** a marker drawn over the unit. No template reads the buff key, and the buff changes nothing.

It compiles to `{ kind, presentationOnly: true, enemies }` and installs nothing in the battle. The marker is not drawn.

## Duq'arael's Sanctuary

14-20 places `enemy_1547_blord_2` with 40,000 HP, 1,000 ATK and `HpAura.damage_resistance` 0.3. The record's value is 0.9. The other nine talent values the stage writes equal the record.
- `shared/arkpedia/enemy-blood-lord-features.js` now declares that key as a stage value and accepts exactly 0.9 or 0.3.
- The runtime already read the value: under the aura he takes 70% of Physical and Arts damage in 14-20.
- The first form appears in 14-20 without a Throne of Blood, as the stage places him.

## Checked

`test/arkpedia-stage-14-20.test.js`:
- **Environment review:** it passes, and refuses a stat change or behaviour template on the marker, another enemy list, a second event, a flag on the holder buff and a deck buff. `filter_id` 1 compiles the nine enemies and 0 every enemy; other parameters and targeting are refused.
- **Sanctuary:** 0.3 is accepted from the stage. 0.95, 0, 0.5 and a changed heal are refused.
- **In 14-20:** the stage carries the one environment, Logos has skill 3 and the module, his damage carries the trait's injury, and the second form's aura holds 0.7 damage-taken multipliers.
- **Headless runs:** 14-20 and its adverse variant clear with life raised to 999. H14-4's adverse variant ends in defeat with no input: its boss costs every life point when it leaks.
- **Browser:** 14-20 opens with Logos on 3,4 and runs with no console errors.

## Not checked

- In game.
- **The marker is not drawn** over the listed enemies.
- **H14-4 adverse** was blocked only by this environment. It was not reviewed beyond its headless run.
