# Leizi the Thunderbringer review

Leizi the Thunderbringer (`char_1043_leizi2`) is a Liberator Guard. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/leizi2.json` in SD.

From data (tables, her own templates and prefab abilities):
- **Trait.** The generic Liberator: no attacks and no block while her skill is inactive. ATK ramps to `atk` over `max_stack_cnt` s and resets when a skill ends.
- **Talent 1** (`leizi2_t_1`, `[fly]`, `[on_calcul]`):
  - she is lifted off while no skill runs;
  - every `interval` s her range tiles call thunder, dealing `atk_scale_t` × ATK Arts to every enemy on a struck tile;
  - during a skill her damage uses `atk_scale[skill_up]` × ATK.
- **Talent 2** (`leizi2_t_2`). Every skill start strikes each ground tile in her range for `atk_scale_t2` × ATK Arts, with `not_combat` s of tremble.
- **S1.** Three charges, range `3-19`: a forward line and a line to each side. It makes one Physical strike of `attack@atk_scale_s1` on a ground enemy in each direction (abilities `s1_m`/`s1_l`/`s1_r`). Her trait ATK is kept until the charges are spent.
- **S2.** Four targets at `attack@atk_scale_s2`. Every thunder strike stacks `thunder_atk` ATK, up to `thunder_max_stack_cnt` (`[try_add_atk]`).
- **S3.** Skill range `2-1`, base attack time +1.7, and a Physical splash of `attack@atk_scale_s3` within `attack@range_radius`. Each attack sends a current from its target three tiles along each lane direction. Enemies on current tiles take `attack@atk_scale_current` Arts every 0.6 s, with `prob` to tremble for `not_combat` s (`leizi2_s_3`).

Declared mappings:
- **Thunder chance.** Talent 1's per-tile chance is the talent text's 10% per second; the original native thunder action does not expose it.
- **S2 range.** It grows "along ground tiles up to three": it walks up to three steps over ground tiles from her range, fixed when she is placed.
- **Currents.** They stop at high ground or at her tile.
- **Not modelled.** Talent 2's physical-damage marks (`leizi2_t_2[scale]`), because the scale they apply is not in her data.

Validation:
- `test/arkpedia-leizi2.test.js` (38 cases) covers:
  - stats, cost, SP and charges at every rank;
  - no attacks and liftoff while idle, and thunder at 100% ATK;
  - the opening strike at 111% with tremble;
  - S1's strikes per direction and the kept ramp;
  - S2's ground reach and thunder stacks;
  - S3's currents and splash;
  - three 0-1 clears.
- `review-leizi2-public.mjs` passes 6 cases on both the candidate and the normal build. It was stable over three reruns once the opening check moved to right after the click.
