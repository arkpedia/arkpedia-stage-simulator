# Haruka review

Haruka (`char_4202_haruka`) is an Abjurer Supporter. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/haruka.json` in SD.

From data (tables and her own templates):
- **Trait.** Abjurer: Arts attacks. While a skill is active she heals `attack@max_target_heal` allies for `heal_scale` × ATK instead.
- **Talent 1** (`haruka_t_1`, `_delay`). Every attack interval, one ally in range without a bubble (`max_target_shield`) gets a bubble of `damage_resistance` Sanctuary. The bubble bursts `interval` s after it first takes enemy damage.
- **Talent 2.** A burst heals that unit for `heal_scale` × her ATK.
- **S1.** +ASPD. A burst gives a bubble to another ally without one, in the eight surrounding tiles.
- **S2** (`haruka_s_2`, `[damage]`):
  - heal targets +`attack@max_target_heal_add`, bubble targets +`max_target_shield_add`;
  - every heal of hers, the talent burst heal included, deals `atk_scale_extra` × the healed amount as Arts to up to `max_target_extra` enemies within `ability_range_radius` of that ally;
  - from the second use, ATK `atk` and no end.
- **S3.** Skill range `y-8`, base attack time −0.6 and +ATK. Bubble Sanctuary is multiplied by `damage_resistance_scale` (`haruka_s_3_scale`). An enemy that attacks a bubbled ally levitates for `levitate_duration` s, taking `atk_scale` × ATK Arts every `interval` s while it floats (`haruka_s_3_debuff_delay`, `_debuff`). Once she is gone, the tick is sourceless.

Declared mappings:
- **Bubble choice.** A new bubble goes to the ally in range without one that has the lowest HP ratio.
- **Heal choice.** Heals pick the injured allies in range with the lowest HP ratio.

Validation:
- `test/arkpedia-haruka.test.js` (37 cases) covers:
  - stats, cost and SP at every rank;
  - bubble Sanctuary, and the burst and its heal;
  - the S1 hand-off;
  - the S2 strikes, and the infinite second use with its ATK;
  - S3's doubled Sanctuary, and the levitation damage;
  - three 0-1 clears.
- `review-haruka-public.mjs` passes 6 cases on both the candidate and the normal build.
