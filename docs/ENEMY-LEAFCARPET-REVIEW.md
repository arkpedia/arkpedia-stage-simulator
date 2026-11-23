# Leafcarpet (`enemy_8013_mcnrsh`)

An elite walker with no attack: 100,000 HP, 0 DEF, 0 RES, speed 0.3, weight 3, stun-immune. It alone blocked VEC-05 "Deathly Pause".

It is admitted from its pinned CN prefab. `shared/arkpedia/enemy-leafcarpet-features.js` holds the contract. It pins:
- the record (talents `rush` and `crash`, no skills);
- every component reachable from the retained abilities `rush` and `crash`, including the crash collider (radius 0.0001; the extractor now keeps that geometry);
- the templates `enemy_mcnrsh_trigger_1`, `enemy_mcnrsh_trigger_2`, `enemy_mcnrsh_t[trigger]` and `enemy_mcnrsh_hit`;
- the skeleton from `refs/arts/enm_art_22.ab` (it has no attack clip).

The runtime is `server/sim/content/arkpedia-enemy-leafcarpet.js`, kind `leafcarpetRush`.

**Feature keys.** `talent:rush` is the Lancers' key. `enemy-charge-features.js` dispatches it to this contract for Leafcarpet, and the Lancers keep theirs.

## The rush

1. **Start.** `enemy_mcnrsh_trigger_2` checks every 0.1 s, the first check after one interval. If Leafcarpet is not blocked, not STUNNED, LEVITATE, FROZEN, UNMOVABLE or FEARED, and has no rush, it starts `mcnrsh_t[trigger]` together with a 5 s `mcnrsh_t_predelay`.
2. **Speed.** `mcnrsh_t[trigger]` fires every 0.333 s, 30 times. Each firing after the predelay adds a stack of `mcnrsh_t[core]`: +0.5 additive MOVE_SPEED MULTIPLIER. That makes 15 stacks and a top speed of 0.3 × 8.5 = 2.55. This follows the Direswine and Lancer reading of the same buff shape.
3. **Interruption.** `enemy_mcnrsh_trigger_1` checks the same flags during a rush, predelay included. If one is set, the rush ends and `weak[limit]` lands. The CN buff table defines it as Fragile (`damage_scale[input]`), taken here for `rush.weak[limit]` = 6 s at `rush.damage_scale` = 2, so Leafcarpet takes double damage. Stun cannot do this, because Leafcarpet is stun-immune; freeze, levitate, bind and fear can.

## The crash

Each ground unit entering the crash collider gets `enemy_mcnrsh_hit` and a `crash.stun` = 4 s stun. Ground only: the target options give motion 1, where the Direswine's give 3. The hit deals `crash.atk_scale` (600) × Leafcarpet's current Movement Speed as Physical melee damage and grants no SP. It lands once per contact. Unlike the Direswine's template, `enemy_mcnrsh_hit` has no `IfEnemyIsMovingBySelf` check.

## Unblockable

No prefab, enemy-database or route field carries it:
- the root has `_blockVolume` 1 and no special block condition;
- `blockCnt` is undefined, as it is for 1,898 blockable enemies.

The handbook line is admitted the way the existing `ability:Cannot be blocked.` precedent does, but only inside this pinned contract.

## Verification

`test/arkpedia-leafcarpet.test.js`:
- **Admission.** Admitted, and the Lancers and the Direswine keep theirs. Each of these is refused:
  - a trigger_1 template without its Fragile step;
  - a 0.5 crash collider.
- **Rush.** Unblockable and stun-immune. The speed holds at 0.3 through the predelay, stacks on the 0.333 s clock after it, and stops at 15 stacks (2.55).
- **Interruption.** A freeze during the rush resets the speed and leaves double damage taken for 6 s, then normal damage.
- **Crash.** A ground guard on the path takes 600 × current speed minus its DEF as Physical damage, once, and is stunned for 4 s. Leafcarpet is not blocked by it. An aerial unit is passed.
- **Compiled VEC-05.** Leafcarpet at its stage stats, unblockable. No battle errors.

The Lancer and Direswine suites pass unchanged. The library rebuild published VEC-05 (1,044 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,044 graphs with no failures. Browser review: the original art loads from asset commit `8cedffd8`, and Leafcarpet speeds across the map.

## Boundaries

- **Effects.** `enemy_mcnrsh_hit_01` and `enemy_mcnrsh_buff_01` are not played.
