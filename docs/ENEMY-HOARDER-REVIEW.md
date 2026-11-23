# Divicellular and Allotropic Hoarders

Ranged Arts shooters that split once:
- **Divicellular Hoarder** (`enemy_1436_dsdivi`): 8,000 HP, 190 ATK, 150 DEF, 35 RES, range 1.8, attack interval 1.6, move speed 1, weight 2.
- **Allotropic Hoarder** (`enemy_1436_dsdivi_2`): 10,000 HP, 230 ATK, 175 DEF, 45 RES; otherwise the same.

The Divicellular Hoarder alone blocked BP-EX-1 "Pillar of Shame - Meaningless Conflict", its Challenge and VEC-SP12 "Unacclimatized". It is also one of the blockers of BP-5, BP-EX-3 and BP-EX-8, which still wait on other enemies.

Both are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-hoarder-features.js` holds the contract. It pins:
- the record;
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the templates;
- `projectile_enemy_dsdivi`;
- the Attack (0.57 s, release at 0.27 s) and Skill (1.83 s) clips from `refs/arts/enm_art_16.ab`.

The runtime is `server/sim/content/arkpedia-enemy-hoarder.js`, kind `hoarderSplit`.

**Feature keys.** The Drifters use the talent key "0" too. `talent:0` in `enemy-drifter-features.js` dispatches `covers`, `ability`, `explains`, the native claim, the stage multipliers and `dependsOn` to this contract for the Hoarders. `skill:0` covers the split cast. `dependsOn` makes each stage ship the record the Hoarder splits into: its own key.

## Attack

One ground operator in range. At the Attack clip's event the Hoarder fires the linear speed-10 projectile `projectile_enemy_dsdivi` (lifetime 10), for ATK Arts.

## The split

`dsdivi_tr_1[listener]` checks every damage the Hoarder takes. On the first hit that leaves HP below `hp_ratio` (50%), if the Hoarder is not silenced and does not carry `dsdivi_tr_1[split_mark]`, the listener triggers skill "0" and ends. A hit taken while silenced leaves the listener in place for the next hit.

Skill "0":
1. **Cast.** It plays the Skill clip (1.83 s) under `dsdivi_tr_1[unmovable]`, which holds it in place for 2 s. It does not attack during the cast.
2. **Split.** When the clip ends, `dsdivi_tr_1` summons one copy of the skill's `enemy_key` (the record's own key) on the Hoarder's remaining route. The copy lands within `offset_bound` (0.3) of the Hoarder, carries the split mark, and takes the Hoarder's HP ratio (`dsdivi_tr_1[copy_hp]`, CopyHealth by ratio).

A copy never splits, and the original splits only once.

## Verification

`test/arkpedia-hoarder.test.js`:
- **Admission.** Both variants are admitted, and each splits into itself. Each of these is refused:
  - a stun check instead of silence;
  - a flat HP copy;
  - two copies;
  - another variant's key.
- **The split.** For both variants:
  - no split at 51% HP;
  - the hit below 50% roots it with no attacks;
  - exactly one copy appears after the 1.83 s clip, at the same HP ratio and within the offset;
  - further hits on either body make no more copies.
- **Silence.** A silenced Hoarder does not split. The next hit after the silence ends does.
- **Compiled BP-EX-1.** The Hoarder has 8,000 HP and 190 ATK, and splits once in the stage. No battle errors.

The library rebuild published BP-EX-1, its Challenge and VEC-SP12 (1,030 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Split timing.** The Skill clip has no attack event, so the split lands at its end.
- **Copy position.** The copy's offset is random within `offset_bound` around the Hoarder. The native `offset_x`/`offset_y` keys are absent from the blackboard.
- **Talent keys.** The talent's `interval` (0.3) and `offset_bound` (0.2) have no reachable consumer in the pinned tree.
