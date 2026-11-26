# Light of Glory and 14-12

Light of Glory `trap_164_lrsiege` (PRTS 振奋荣光) is an ally-side trap that a wave action switches on in 14-12 and 14-10. 14-12 also needs a stage-local 600-HP Caustic Originium Slug, `enemy_1424_lrboom_3`, and its adverse version a stronger slug blast.

This batch publishes 14-12 and 14-12 adverse (1,175 available; main story 444 of 564).

**Still blocked**
- **14-10:** the `level_deck_cards_enable` rune and the Charles Lynch device.
- **Stages with an Active Originium Storm and Light of Glory:** refused, because the device's storm talent is not modelled.

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

**Talent `1`** acts on an Active Originium Storm (`enemy_bigstorm[passive]`). It is not modelled (`LIGHT_OF_GLORY_UNMODELLED`).

**The slug alias** (`shared/arkpedia/enemy-aliases.js`)
- 14-12's `enemy_1424_lrboom_3` is a stage definition with 600 HP and no talent blackboard.
- PRTS lists it as the same Caustic Originium Slug with only its HP changed. The new `enemy_1424_lrboom` contract therefore keeps the prefab's talents (`inheritTalents`) and abilities, for a walking melee body.

**The adverse override:** 14-12 adverse sets the slug's `Boom.atk_scale` to 5. The death-blast feature now accepts that one number (`stageOverrides`).

## Runtime

`server/sim/content/arkpedia-stage-light-of-glory.js` (family `lightOfGlory`, device-runtime index; `activateStagePredefined` calls `activate(alias)`):
- **Activation:** hidden until its scheduled action. On activation it places its body (invulnerable, untargetable) and starts the step.
- **Every tick:** the circle grows as reviewed. Operators inside share one aura buff (`atkPct` 3, `defPct` 4, `resPct` 0.3, `hpRegen` 300); enemies inside get `moveFlat` −0.1.
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
- **Refused:** a stage with an Active Originium Storm.
- **Headless clears:** 14-12 and 14-12 adverse.

## Not checked

- In game.
- **Inferences**
  - **One circle:** the operator and enemy auras are read as one circle, with the tile radius 0.5 + steps. The colliders' base radius 1 is not added. PRTS gives the speed as 1.0; the data gives about 0.67 tiles/s.
  - **Profession mask 767** is read as every profession but TRAP.
  - **Clearing pollution zones:** the slug's pollution is a zone in this simulator, so clearing removes zones whose centre lies inside.
  - **The alias:** an undefined talent blackboard keeps the prefab's, per PRTS's listing.
- **Not modelled:** PRTS's stage note also lists "damage taken −30%". No reviewed modifier gives it, so it is not applied.
