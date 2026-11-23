# 'The Abandoned' and 'The Cursed'

Arts attackers whose shots splash unless they are blocked:
- **'The Abandoned'** (`enemy_1440_dselec`): 19,000 HP, 720 ATK, 900 DEF, 35 RES, range 1.8, attack interval 5.
- **'The Cursed'** (`enemy_1440_dselec_2`): 22,000 HP, 880 ATK, 950 DEF, 40 RES.

Both together blocked BP-EX-3 "Great Bathhouse - Where Wisdoms Meet" Challenge (22,800 / 26,400 HP there). The normal BP-EX-3 also waits on the Heralds (`enemy_1438_dspred`).

Both are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-abandoned-features.js` holds the contract. It pins:
- each record;
- every component reachable from the retained abilities;
- the templates;
- `projectile_enemy_dselec`;
- the `x-5` range;
- the Attack and Combat clips (2.33 s each, hit at 0.93 s) from `refs/arts/enm_art_16.ab`.

The runtime is `server/sim/content/arkpedia-enemy-abandoned.js`, kind `abandonedSplash`.

## Attacks

- **Unblocked** (the Attack ability, Attack clip): `projectile_enemy_dselec` uses the fixed-delay movement with delay 0, which the Nova Knight review read as landing at once. It hits every selectable unit, ground or aerial, on the `x-5` cross around the target's tile (the tile and its four neighbours) for ATK Arts.
- **Blocked** (the Combat ability, Combat clip): it strikes the blocker alone for ATK Arts. "Loses splash damage when blocked."

Ability "0" (`dselec_tr_1`) derives a visual-only marker while blocked. `KilledToLog` is a kill counter.

## Verification

`test/arkpedia-abandoned.test.js`:
- **Admission.** Both are admitted. Another splash range is refused.
- **Unblocked.** For both variants, the target and a unit on a neighbouring tile take ATK Arts; a diagonal unit takes nothing.
- **Blocked.** Only the blocker is hit.
- **Compiled BP-EX-3 Challenge.** Both variants are at their Challenge stats (22,800 HP / 864 ATK and 26,400 HP / 1,056 ATK). No battle errors.

The library rebuild published BP-EX-3's Challenge (1,040 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Instant landing.** The splash lands with no flight time.
- **Arc.** No arc is drawn; an explosion marker shows the splash.
