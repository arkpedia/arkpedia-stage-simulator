# Violet Mizutsune Orchid review

Violet Mizutsune Orchid (`char_1048_orchd2`) is a Closerange Sniper. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/orchd2.json` in SD, re-bound with her literal `Start_1`/`Attack_1`/`Attack_Down_1` roles.

From data (tables, hidden talents, her own templates and prefabs):
- **Ordinary attack.** A salvo of three arrows (`_salvoCount` [3]), each `attack@damage_scale` of the hit (hidden talent). The salvo lands at the `Attack_1`/`Attack_2` clip events, alternating the two clips.
- **Talent 1** (`orchd2_t_2`). The first skill cast of a deployment powers the next `power_attack_count` ordinary attacks to `power_attack_scale` ATK.
- **Talent 2** (`orchd2_t_1`, `t_1_2`):
  - redeployment time `respawn_time` (hidden talent; the roster build already applies it) and no redeployment cost increase;
  - deploying inside `ignore_build_type_target_range` (`x-1`) around her last tile allows melee tiles, gives ATK `atk` for `atk_duration` s, and plays `Start_2`.
- **S1.** Four charges, released automatically when all are full (`[auto]`). It fires four arrows of `atk_scale_1`. If another charge is left, it spends it on 刚连射: five arrows of `atk_scale_2`, each with `stun_prob` to stun for `stun` s. The arrows land at the `Skill_1_End_*` events.
- **S2.** Three charges, cast once on deployment without SP (`[auto_once]`). She lifts off and fires `Skill_2_Loop_1..3` at every enemy in the skill range, with 3/4/5 arrows (`_additionalTimes` 2/3/4) of `attack@atk_scale_loop`. She then lands with `attack@atk_scale_end`.
- **S3.** Two charges. After `Skill_3_Begin` and `wait_duration` she fires a piercing arrow (`projectile_chr_orchd2_s3`: speed 10, `_distanceInterval` 0.25 in Q32 fixed point) along her facing, up to `max_dist`. Every 0.25 tiles travelled it deals `atk_scale` Physical and `atk_scale_magic` Arts to enemies around it, and it pushes each enemy it passes at `force`.

Declared mappings:
- **Hit area.** The S2 landing and the S3 arrow strike enemies within 0.5 of their point, because the prefab selector ranges carry no fields.
- **S1 refund.** If the target is gone when the arrows fire, the cast refunds its charges (`[recover_sp_checker]` TARGET_DEAD).

Validation:
- `test/arkpedia-orchd2.test.js` (39 cases) covers:
  - the prefab salvo counts and arrow clock;
  - stats, cost, SP and charges at every rank, including her adjusted redeploy time;
  - the salvo split, and the powered attacks with their count;
  - the redeploy time, the unchanged cost, the melee return tile and its ATK;
  - S1's four arrows plus 刚连射, and the auto release;
  - S2's deployment cast, liftoff, 12 arrows per enemy and the landing;
  - S3's Physical/Arts ticks and its push;
  - three 0-1 clears.
- `review-orchd2-public.mjs` passes 6 cases on both the candidate and the normal build, including a return deployment onto a melee tile in the UI.
