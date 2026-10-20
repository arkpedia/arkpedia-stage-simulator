# Astgenne the Lightchaser review

Astgenne the Lightchaser (`char_1047_halo2`) is a Decel Binder Supporter. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/halo2.json` in SD.

From data (tables and her own templates):
- **Trait and ordinary attack.** Her ordinary attack deals Arts damage, with the hit at the Attack clip event (0.7 s). Each hit applies sluggish for `sluggish` (0.8 s).
- **Talent 1** (`halo2_t_2`). Each sluggish she applies gives +`attack_speed` ASPD. It stacks up to `max_stack_cnt` (18) and lasts while she stays deployed.
- **Talent 2** (`halo2_t_1`, `[check]`, `[weak]`). Enemies in her range take fragile (`weak[inf]`) at `damage_scale` (1.12). It rises by `damage_scale_add` every `interval` (7 s) in range, up to `damage_scale_max` (1.16). Leaving her range removes it.
- **S1.** +ATK. Each attack jumps between enemies up to `attack@chain.max_target` times within `attack@projectile_range`, and every jump deals full ATK with sluggish.
- **S2.** Automatic; it charges on attacks and fires on her next attack. That attack hits the `max_target_attack` enemies in range farthest from her for `atk_scale`, with sluggish for `sluggish` s. From each target, it links up to `max_target` other enemies within `ability_range_radius`. Linked enemies are pulled toward that target at `force` and take `atk_scale_link`.
- **S3.** Skill range `y-4`, +ATK, base attack time −0.7 and two targets (`halo2_s_3_link`/`_damage`). Arts damage she deals to one linked target is shared to the other linked targets at `attack@atk_share` of its pre-mitigation value. The share is her own non-continuous Arts only, and it never re-shares.

Declared mappings:
- **S1 jumps.** Each jump goes to the nearest enemy other than the one just hit, so it can bounce back ("重复跳跃").
- **S2 target point.** The target point is her own position. An S2 target is not also linked by the other target.
- **S3 links.** The links are the targets of her latest S3 attack.

Validation:
- `test/arkpedia-halo2.test.js` (38 cases) covers:
  - stats, cost and SP at every rank;
  - the Arts hit, sluggish and the 18-stack ASPD cap;
  - fragile at 12%, rising to 16%, and its removal when an enemy leaves range;
  - S1's three jumps bouncing between two enemies;
  - S2's two farthest targets, the pull link and its damage;
  - S3's 25% share;
  - three 0-1 clears.
- `review-halo2-public.mjs` passes 6 cases on both the candidate and the normal build.
