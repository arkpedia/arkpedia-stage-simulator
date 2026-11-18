# Theresa and the Cocoon Cage

This batch admits `enemy_1554_lrtsia` (Theresa) and gives `enemy_1432_lrccon` (the Cocoon Cage, 茧缚) its native behaviour. The cage was previously admitted as a plain body and appeared in no published stage. It publishes 14-21 and 14-21 Adverse. H14-4 still waits on Patriot and the `mainline14_enemy_sign_effect` environment.

Theresa has two database levels with the same skills:
- level 0: 50,000 HP, 200 ATK, 500 DEF, 60 RES; used by 14-21 and 14-21 Adverse;
- level 1: 80,000 HP, 300 ATK, 500 DEF, 80 RES; used only by H14-4.

Level one lists only the keys it changes, and is read as an overlay on level zero (the reviewed Jesselton reading). Its 35% Banish, +250% HP and +2,000 DEF are therefore unverified on a compiled stage.

The rules not fixed by the data come from PRTS (`特蕾西娅`, `茧缚`).

## The Cocoon Cage

`shared/arkpedia/enemy-cocoon-cage-features.js` pins the prefab's 12 components and its five templates. The new native-only feature `native:cocoonCage` attaches the `cocoonCage` kind.

- **Body.** It never attacks and stands still. It is unblockable and cannot be healed. It ignores damage without a source (`block_no_source_dmg`). It is not counted in the stage total.
- **Lock.** Every 0.3 s (`enemy_lrccon[lock]`, range 0-1) the operator on its tile gets `lock_core`: stunned, disarmed, no skill activation, cannot retreat, cannot block, and invincible.
- **New engine flag.** `noRetreat` refuses the player's retreat, and the retreat button is disabled.
- **Invincibility.** A cage that holds nobody is invincible. A cage that holds an operator can be attacked, and loses 1 HP when it first does so at full HP.
- **Defeat.** It moves to the defeating unit's tile, if that tile has no cage (`transport`). If the source is gone, it stays on its own tile.
- **One cage per tile.** The native `lrccon_flag` tile blackboard; the battle keeps the cages by tile.

## Theresa

`shared/arkpedia/enemy-theresa-features.js` pins:
- every component reachable from her abilities (158, across her four modes);
- 26 templates and the six dust projectiles;
- the clip clocks from `refs/arts/enm_art_17.ab`.

The runtime is the new `theresa` kind, attached through `talent:HpCounter`, which claims six wrappers and four active abilities. The shared keys defer to her contract:
- `ability:First Form`, `ability:Second Form` and `talent:Reborn` through the form-boss list;
- `talent:PassiveP2`, which she shares with Andoain, through an explicit combined key. Each record goes to its own contract.

### Throughout

- **No attacks.** She does not attack, move or get blocked, and is immune to stun, freezing and the other controls in her record.
- **Soul capture.** A Soul Maelstrom within 1.0 of her heals her by its remaining HP and leaves (`captureSoul`). This also works while she revives, and not in form three.

### Eternal Dust

- **Rings.** One ring in form one: radius 1.0, counter-clockwise. Two rings in form two: radius 1.0 counter-clockwise and radius 2.0 clockwise. Each turns at 90°/s with 4 visible and 36 invisible motes.
- **Motes.** An operator a mote touches (0.2 plus the operator's collider) consumes it. A visible mote deals 100% ATK as Arts damage and returns after 1.9 s. An invisible mote returns after 2.3 s.
- **The cut (`EnemyLrtsiaCheckDamageBlocked`).** Damage from a source at least the ring's radius away is cut to 10% when the source lies within 10° behind a present invisible mote, against its rotation. Damage without a source is always cut. Form two checks ring one, then ring two.
- **Gaps.** With all 36 invisible motes present every direction is covered. Gaps open only where operators touch the ring.

### Form one

- **Banish.** Every 55% of max HP she loses (35% on level one; damage after the cut), she casts C1_Skill_3. At its strike (1.43 s), every ground operator within 1.5 gets a cage on its tile.
- **Downed operators.** A 0.3 s poll cages the tile of an operator at or below 0% HP, once per dip. Live operators rarely reach that, so this seldom fires.
- **Weave Cocoon.** The first cast comes at 400 s. With cooldown 0, a new cast starts as soon as the last ends (C1_Skill_4, strike at 1.37 s).
- **The spread.** Every cage spreads to its four neighbours. It cannot spread onto a pit, a special (start/end) tile, undeployable high ground, a cage or an obstacle.
- **Doom.** When at least 59 cages are on the field, she casts Doom and the player loses 100 Life Points at the end of the clip.

### Revives and the later forms

- **First knock-out.** A 10 s revive, invincible and untargetable. She has 1 HP until 1.33 s, then 50% of her max HP.
- **Form two.**
  - The current wave is released.
  - Max HP +200%, DEF +1,000, RES -40. The engine keeps the HP ratio when max HP changes, so she starts at 50% of the larger max.
  - Weave Cocoon at 10 s, then every 45 s, plus a forced one for every 30% of max HP lost.
  - Doom as in form one.
- **Second knock-out.** A 5 s revive. At 0.07 s into it, `enemy_1554_lrtsia_2` is summoned where she stands to hold the wave. It is scheduler-tracked, does not move, cannot be hurt and costs no Life Point (her `_unharmful` summon and its own `Unmovable` passive). She ends at 50% HP.
- **Form three.** Invincible. Weave Cocoon at once, then every 8 s (C3_Attack, strike at 1.0 s). No dust and no Doom. The battle ends as cleared 13 s later.

## Verification

`test/arkpedia-cocoon-cage.test.js`:
- **Admission.** The cage is admitted; changed HP, counting in the total, or a changed lock poll are each refused.
- **Lock.** An operator on the tile gets every lock flag. The cage becomes attackable, loses 1 HP, and ignores sourceless damage. An empty cage is invincible.
- **Transfer.** Defeat moves the cage to the defeater's tile and ends the lock. A sourceless defeat keeps it in place. A defeater already caged gets no second cage.

`test/arkpedia-theresa.test.js`:
- **Admission.** Both levels are admitted. Each of these is refused: a changed Doom count, a changed weave cooldown, one revive instead of two, and a wider Banish collider. The level-one overlay gives the expected values.
- **Dust.** The adjacent operator is struck for 100% Arts. Far and sourceless damage is cut to 10%. Damage from inside the ring, or through gaps, is not.
- **Banish.** It casts at 55%. Cages appear at the strike within 1.5, not farther. The low-HP poll cages a 0 HP operator.
- **Weave and Doom.** The first weave at 400 s spreads the cages, sparing obstacles and caged tiles, and recasts at once. Doom at 59 cages ends the battle as defeated.
- **Revives.** Soul capture heals her. The first revive gives 50% at 1.33 s and form two (×3 HP, +1,000 DEF, -40 RES, the wave released, two rings, a forced weave at 30%). The second revive summons the holder. Form three is invincible, weaves at once, and the battle is cleared after 13 s.
- **Compiled stages.** On 14-21 and 14-21 Adverse (50,000 and 60,000 HP after the runes; Doom 59):
  - Banish cages a deployed Myrtle beside her, and retreating her is refused;
  - both revives happen;
  - the holder stands with her and nothing leaks;
  - the battle ends cleared 13 s into form three, with no battle errors.

The library rebuild published exactly two more stages, 14-21 and 14-21 Adverse (1,011 available). No other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and 14-21 runs in the preview with Theresa drawn and no console errors.

## Boundaries

- **Spread tiles.** `EnemyLrtsiaSummonEnemyOnSurroundTiles` is compiled code. Which tiles a cage may spread to comes from PRTS's list. "Some special tiles" is read as the start and end tiles, and fence tiles are allowed.
- **Rotation sense.** Counter-clockwise is taken in the battle's screen frame (rows grow downwards). With full rings the cut is the same either way; it only changes where a gap falls.
- **Mote contact.** A collision is the mote's 0.2 plus the operator's collider (0.25). Operators on orthogonal neighbours touch the inner ring; diagonal ones do not.
- **Doom timing.** It acts on cast event 4 (`_runActionOnEvent`), read as the end of its clip (2.03 s in form one, 2 s in form two).
- **Revive HP in form two.** She starts form two at 50% of the tripled max HP, from the engine's ratio-keeping max-HP rule. If the game keeps the absolute HP instead, she would start at about 17%. This is an in-game check.
- **Banish counter.** Several thresholds crossed at once queue one Banish each.
- **Cage art.** The cage and the holder have no Spine body (effect/mesh renderers), so the model importer skips them and they are not drawn. The dust motes are not drawn either.
- **H14-4.** Not published: Patriot and its environment. Theresa's level one is admitted but unverified on a compiled stage.
