# Light of Glory and 14-12

Light of Glory `trap_164_lrsiege` (PRTS 振奋荣光) is an ally-side trap that a wave action switches on in 14-12 and 14-10. 14-12 also needs a stage-local 600-HP Caustic Originium Slug, `enemy_1424_lrboom_3`, and its adverse version a stronger slug blast.

This batch publishes 14-12 and 14-12 adverse (1,175 available; main story 444 of 564).

14-10 (and the storm talent below) followed in the next batch; see `docs/STAGE-14-10-REVIEW.md`.

## Native evidence

`shared/arkpedia/stage-light-of-glory.js` (`lightOfGloryNativeReviewed`) checks the pinned prefab (now kept by the device extractor with its colliders), its three talents, `sktok_lrsiege` and five templates.

**The device**
- Side 1, category 2: nothing selects it.
- `sktok_lrsiege`: AUTO, 0 SP.
- Stat blocks (20,000 HP and so on) are unused, because nothing can hit it.

**Talent `2`** (`trap_lrsiege[buff]`)
- **Who:** operators, via a validator with side 1 and profession mask 767. 767 is read as every profession but TRAP.
- **Modifiers:**
  - ATK and DEF as MULTIPLIER from `atk` 3 and `def` 4 (+300% and +400%);
  - RES as MULTIPLIER from `magic_resistance` 0.3 (+30%);
  - ASPD as ADDITION from `attack_speed`, which is absent, so 0;
  - HP recovery as ADDITION from `hp_recovery_per_sec` (300).
- **Leaving:** the buff is removed when the target leaves.
- **Passive `trap_lrsiege[switch_tile]`:** every 1 s, `SwitchDynamicBuffTileModeInRange` within the current radius.

**Talent `3`** (`trap_lrsiege[buff][enemy]`): enemies (side 2), Movement Speed ADDITION from `move_speed` (−0.1).

**Growth** (`trap_lrsiege[ctrl]`, every 0.03 s)
- **Step:** starts at `radius_increase_per_tick` (0.0102) and gains `radius_increase_addon_per_tick` (0.001) each tick, up to `max_radius_increase_per_tick` (0.02).
- **Radius:** `range_radius` (0.5) plus the summed steps, at most `max_radius` (20).
- **Rate:** about 0.67 tiles per second once the step is at its cap. The radius reaches 20 about 31 s after activation.

**Talent `1`** (`trap_lrsiege[eliminate_storm]`; added with 14-10)
- **Who:** any enemy carrying `enemy_bigstorm[passive]` (an Active Originium Storm). The ability has no range collider, so it reaches the storm anywhere; it checks every 0.1 s.
- **Delay:** the buff lasts `predelay` (7) s; when it ends, the storm gets `trap_lrsiege[eliminate_storm][core]` for life.
- **Core** (every 0.03 s): the storm's growth stops. Its step starts at `radius_decrease_per_tick` (−0.0082) and gains `radius_decrease_addon_per_tick` (−0.002) each tick, down to `max_radius_decrease_per_tick` (−0.012); the steps add to the storm's radius. When the radius before the tick plus −0.0082 is below `radius_floor` (0.5), the storm is killed outright (`InstantKill`), invulnerable or not.
- **Rate:** 0.4 tiles per second once the step is at its cap.

**The slug alias** (`shared/arkpedia/enemy-aliases.js`)
- 14-12's `enemy_1424_lrboom_3` is a stage definition with 600 HP and no talent blackboard.
- PRTS lists it as the same Caustic Originium Slug with only its HP changed. The new `enemy_1424_lrboom` contract therefore keeps the prefab's talents (`inheritTalents`) and abilities, for a walking melee body.

**The adverse override:** 14-12 adverse sets the slug's `Boom.atk_scale` to 5. The death-blast feature now accepts that one number (`stageOverrides`).

## Runtime

`server/sim/content/arkpedia-stage-light-of-glory.js` (family `lightOfGlory`, device-runtime index; `activateStagePredefined` calls `activate(alias)`):
- **Activation:** hidden until its scheduled action. On activation it places its body (invulnerable, untargetable) and starts the step.
- **Every tick:** the circle grows as reviewed. Operators inside share one aura buff (`atkPct` 3, `defPct` 4, `resPct` 0.3, `hpRegen` 300); enemies inside get `moveFlat` −0.1.
- **Storms:** every storm it finds gets the core 7 s later; the shrink runs on its own 0.03 s clock (several ticks can fall in one battle step).
- **Every 1 s:** the stage's pollution tiles inside are cleared, and so are transient pollution zones whose centre is inside. The simulator draws a slug's death pollution as a zone, not as tiles. The circle is drawn as a zone effect.

## Checked

`test/arkpedia-light-of-glory.test.js`:
- **Review:** it passes. Refused:
  - a weaker ATK buff;
  - a faster spread;
  - buffing devices too.

  The growth gives about 0.67 tiles/s and radius 20 by 1,100 ticks.
- **The alias:** 600 HP, the base slug's abilities and blast (3.5). On the adverse version the base slug blasts at 5 and the alias stays at 3.5.
- **14-12:**
  - Switched on by its second-wave action.
  - The radius follows the reviewed growth.
  - An enemy inside is slowed, and a pollution zone inside is cleared.
  - The nearest story operator gets ATK ×4, DEF ×5 and RES ×1.3 once inside.
- **The storm:** see `test/arkpedia-charles-lynch.test.js` (14-10).
- **Headless clears:** 14-12 and 14-12 adverse.

## Not checked

- In game.
- **Inferences**
  - **One circle:** the operator and enemy auras are read as one circle, with the tile radius 0.5 + steps. The colliders' base radius 1 is not added. PRTS gives the speed as 1.0; the data gives about 0.67 tiles/s.
  - **Profession mask 767** is read as every profession but TRAP.
  - **Clearing pollution zones:** the slug's pollution is a zone in this simulator, so clearing removes zones whose centre lies inside.
  - **The alias:** an undefined talent blackboard keeps the prefab's, per PRTS's listing.
- **Not modelled:**
  - PRTS's stage notes also list "damage taken" −30% (14-12) and −90% (14-10). No reviewed modifier gives it, so it is not applied.
  - PRTS says the storm's intensity falls by 1 per second. The data shrinks only its radius (0.4 tiles/s, about one 0.35-tile intensity step per second); its damage is left as it was.
