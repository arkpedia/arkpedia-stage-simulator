# Multicellular and Allotropic Heralds

Melee Seaborn that can devour one Excrescent Carapace:
- **Multicellular Herald** (`enemy_1438_dspred`): 13,200 HP, 1,050 ATK, 660 DEF, 45 RES, weight 4.
- **Allotropic Herald** (`enemy_1438_dspred_2`): 14,500 HP, 1,200 ATK, 770 DEF, 60 RES.

The Multicellular Herald alone blocked BP-5 "Lethal Fate". Together with the Allotropic Herald it blocked BP-EX-3 "Great Bathhouse - Where Wisdoms Meet" (the Challenge was published with the Abandoned).

Both are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-herald-features.js` holds the contract. It pins:
- each record (skills "0" and "1");
- every component reachable from the retained abilities;
- the `dspred_tr_1` templates;
- the Attack (2.13 s, hit at 0.73 s) and Skill (2.6 s) clips from `refs/arts/enm_art_16.ab`.

The runtime is `server/sim/content/arkpedia-enemy-herald.js`, kind `heraldDevour`.

**Feature keys.** `skill:0` is the Hoarder's key too. `enemy-hoarder-features.js` dispatches it to this contract for the Heralds.

## The devour

1. **Skill "0"** has a cooldown of 1,000,000, so it fires once. Its trigger takes the first opposing unit within `range_radius` (0.35), target-free ones included; Carapaces are target-free. The Emperor's Blade review set the precedent of reading `range_radius` as the radius. `dspred_tr_1` on that unit (through `[blockee]`) triggers skill "1" on it, interrupting the current action, unless the Herald has already eaten.
2. **Skill "1"** plays the Skill clip (2.6 s). The Herald stands still and does not attack. The clip's only event is an audio cue, so the cast lands at its end:
   - `dspred_tr_1[kill]`: if the unit is an Excrescent Carapace (`trap_156_dsshell_passive`), it is killed and the Herald is marked as having eaten;
   - `dspred_tr_1[switch_mode_2]`: if it ate, the Herald switches to mode 1 (the `B_` clips, the same melee attack) with MAX_HP and ATK MULTIPLIER from the skill's `maxhp` (0.7) and `atk` (0.4), and the mark that stops any further meal.
3. **One chance.** If the first unit it reaches is not a Carapace, the clip still plays, nothing is eaten, and skill "0" never fires again.

## Stage fix: Carapace instances

BP-5 is the first published stage that pre-places Excrescent Carapaces. Its first build failed the smoke check: "Unsupported device configuration".

`compileStage` (`tools/arkpedia/build-stage.mjs`) attached original instances to the other static devices but not to Carapaces, while `StageCarapaces` needs each Carapace's level. Carapaces now carry their original instance, validated through `carapaceDefinition`. Only BP-5's bundle changed.

## Verification

`test/arkpedia-herald.test.js`:
- **Admission.** Both are admitted, and the Hoarder keeps `skill:0`. Each of these is refused:
  - another Carapace check;
  - another `maxhp`.
- **Compiled BP-5, Carapaces.** Every Carapace carries a valid original instance and stands on the field.
- **Compiled BP-5, the meal.** A Herald at 13,200 HP and 1,050 ATK, set next to a Carapace, eats it after the 2.6 s clip. It ends with 13,200 × 1.7 max HP, 1,050 × 1.4 ATK and the mark. No battle errors.

The library rebuild published BP-5 and BP-EX-3 (1,042 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,042 graphs with no failures after the instance fix, and the browser review passed.

## Boundaries

- **Current HP.** When max HP rises, current HP follows the engine's usual rule for a max-HP buff.
- **Mode 1 visuals.** The `B_` clips are not switched in the viewer.
