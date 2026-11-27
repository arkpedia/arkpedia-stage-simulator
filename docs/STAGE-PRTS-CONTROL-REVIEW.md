# Chapter 15, the PRTS control system (inert levels only)

Every chapter 15 stage names the stage system `env_v060_mainline15_prtsCtrl` through its `env_system_new` rune. The system is compiled game code. This batch accepts it only where a level gives it nothing to do, which publishes 15-4 (1,184 available; main story 452 of 564).

## What the system is

`tools/arkpedia/extract-stage-environments.py` now retains its prefab. `shared/arkpedia/stage-prts-control.js` (`prtsControlNativeReviewed`) reviews what the prefab names:
- **Its actor:** the Intrusive Call `enemy_10072_mpprhd`.
- **Its tile:** `tile_mpprts_enemy_born`, where it drags enemies from.
- **Eight enemy-to-device pairs** it places: both drink machines, both monstrosity echoes, both caster crystals, and the Weakening Node twice.
- **No numbers:** the rune carries only the system's name.

Everything it does runs through the Intrusive Call. A level without the Intrusive Call and without a drag tile leaves it idle.

## What is accepted

- **The rune** compiles to `prtsControl: true` (`compilePrtsControlRule`); any extra parameter is refused.
- **The level check** (`tools/arkpedia/stage-environments.mjs`, `prtsControlInert`): the original level must not name the Intrusive Call anywhere (enemy list, waves, branches, routes, placed units) and must have no drag tile. Otherwise the stage is refused with "Unsupported PRTS control actions (the Intrusive Call)".
- **The battle** installs nothing for it.

Of the 36 stage entries that name the system, three have neither the actor nor the tile: 15-4, its six-star variant and 15-19.
- **15-4** is published. PRTS lists 30 enemies and no devices for it, as compiled.
- **15-4 six-star** is still blocked by a labelled attribute rune (`enemy_attribute_mul.rune_alias`).
- **15-19** is still blocked by `level_input_card_delete`.

The other 33 need the Intrusive Call's actions.

## Checked

`test/arkpedia-prts-control.test.js`:
- **Review:** it passes, and refuses another actor, another drag tile or a missing device pair. The rune refuses an extra parameter.
- **Inert check:** true for a plain level; false with the Intrusive Call in the enemy list or in a wave action, and with a drag tile.
- **15-4:** available, compiled with the rule and without the Intrusive Call; a headless run spawns all 30 enemies and ends with no errors (life raised to 999). 15-5 stays blocked.

## Not checked

- In game, and not in the browser.
- **Inference:** that the system does nothing without its actor and tile. It rests on the prefab naming only those two entry points.
- With no player input every enemy in 15-4 leaks.
