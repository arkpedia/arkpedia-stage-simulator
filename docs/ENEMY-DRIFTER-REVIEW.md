# Toxocellular and Allotropic Drifters

Two ranged flyers:
- **Toxocellular Drifter** (`enemy_1435_dsflys`): 5,100 HP, 300 ATK, 80 DEF, 30 RES, range 2.5, attack interval 3.5, move speed 0.7, weight 2.
- **Allotropic Drifter** (`enemy_1435_dsflys_2`): 6,200 HP, 380 ATK, 120 DEF; otherwise the same.

The Toxocellular Drifter alone blocked BP-1 "First Contact". The Allotropic Drifter's stages (BP-EX-1 and its Challenge) still wait on `enemy_1436_dsdivi`.

Both are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-drifter-features.js` holds the contract. It pins:
- the record;
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the `empty` and `log_killed` templates;
- `projectile_enemy_dsflys`;
- the Attack clip clock from `refs/arts/enm_art_16.ab`: 1.83 s, release at 0.83 s.

The runtime is `server/sim/content/arkpedia-enemy-drifter.js`, kind `drifter`. It sits under `talent:0`, a key the Divicellular Hoarders share (the key dispatches by record; see `ENEMY-HOARDER-REVIEW.md`).

## Attack

One target in range, ground or aerial. At the Attack clip's event the Drifter fires the linear speed-10 projectile `projectile_enemy_dsflys` (lifetime 10), through the shared `animatedProjectileAttack` transport.
- **Physical damage:** ATK.
- **Nervous Impairment:** ATK × `attack@ep_damage_ratio`. The talent "0" sets it to 0.15, overriding the prefab's 0.12.

**Priority.** The selector's `_postFilter` 52 is read as the handbook line says: an operator on high ground (tile height HIGH) comes first. After that the ordinary enemy order applies (blocker, taunt, latest deployed).

## Ability "1": unbalance immunity

A permanent `dsflys_immune` buff with abnormal flag 8, which is UNBALANCE_IMMUNE in the pinned status definitions. The Drifter is never shifted (`noDisplace`). The engine never displaced flyers anyway.

`KilledToLog` is a kill counter with no combat effect.

"Flying unit." keeps the existing flying-unit feature (`hover`).

## Artwork

The Allotropic Drifter's model is in the asset repo (39840d88). The Toxocellular Drifter's material uses a straight-alpha shader. `extract-native-enemy-models.py` refuses that shader ("needs separate review"), and no straight-alpha enemy path exists yet. So in BP-1 the Toxocellular Drifter is drawn with the renderer's labelled fallback marker. Its combat is complete. The straight-alpha path is a follow-up.

## Verification

`test/arkpedia-drifter.test.js`:
- **Admission.** Both variants are admitted. Each of these is refused:
  - another element;
  - Arts instead of Physical;
  - `_postFilter` 4;
  - another immunity flag;
  - another ratio.
- **Shots.** For both variants, one shot at the clip event deals ATK Physical and ATK × 0.15 neural. The Drifter cannot be shifted and is airborne.
- **Priority.** An operator on high ground is chosen over one on the ground.
- **Compiled BP-1.** The Toxocellular Drifter has 5,100 HP and 300 ATK, and shoots a deployed Myrtle with both damage types. No battle errors.

The library rebuild published BP-1 together with CW-1 (1,026 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures. The browser review passed, and BP-1 runs in the preview with no console errors.

## Boundaries

- **`_postFilter` 52.** It is read from the handbook line (high ground first), not from a decoded enum.
- **Nervous Impairment source.** It is applied on each attack hit with the existing enemy `elem` helper, as for the other ep-damage enemies.
- **Presentation.** The hit effect and the Toxocellular body art are not reproduced.
