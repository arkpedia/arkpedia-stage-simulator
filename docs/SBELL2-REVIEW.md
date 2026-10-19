# Pramanix the Prerita review

Pramanix the Prerita (`char_1046_sbell2`) is a Phalanx Caster. Her foundation was extracted after the extractor gained effect-only token support: `token_10058_sbell2_icetgt` has no Spine art. The art receipt is `source-reviews/sbell2.json` in SD.

From data (tables and her own templates):
- **Trait.** The generic Phalanx: no attacks and raised DEF/RES while no skill runs; area Arts attacks while a skill runs.
- **Talent 1** (`sbell2_t1[snow_trigger]`/`[enemy_enter]`/`[enemy_leave]`):
  - every `interval` s, each ground tile in her range gains a snow layer, up to `max_cast_cnt`;
  - a ground enemy that enters a snowy tile takes `talent_magic_scale` × ATK Arts at once, and is slowed by `move_speed` per layer while on it;
  - the first enemy to leave a tile clears its snow.
- **Talent 2** (`sbell2_t2[hit_cold]`, `[escape_dead]`). An enemy that damages her is cold for `cold` s. The first fatal damage instead restores her HP, freezes her for `freeze` s and freezes every enemy in her range for `c2e_freeze` s.
- **S1.** Two charges. `atk_scale` Arts to every enemy in range, with `cold` s of cold and a `force` push along her facing. Snow then spreads up to `trig_cnt` ground tiles ahead.
- **S2.** Automatic, infinite, and can be stopped manually.
  - Attacks deal `attack@atk_scale_s2`.
  - Snow past `max_cast_cnt` spreads one layer to a neighbouring ground tile, up to `talent@max_cast_tile_count` tiles.
  - Ground enemies on snow take `talent@s2_magic_scale` × ATK Arts a second, and are cold for `talent@cold` s when they leave it.
  - A tile that reaches `max_cast_cnt` freezes the enemies on it.
- **S3.** Skill range `x-2`, +ATK, +ASPD and `magic_resist_penetrate_fixed`, with attacks of `attack@atk_scale_s3`. Enemies in range are attracted to her for `attract_time` s, and snow forms every `interval` s.

Declared mappings:
- **Snow spread.** S1's spread and S2's overflow add one layer to each ground tile they reach.
- **Frozen target point.** S2's "冻结 target point" is a freeze of the enemies on that tile. The effect-only `icetgt` token that marks it is not drawn.
- **Drawing.** Snow layers are simulated but not drawn.

Validation:
- `test/arkpedia-sbell2.test.js` (39 cases) covers:
  - stats, cost and SP at every rank;
  - snow timing, the enter strike, the per-layer slow and the clear on leaving;
  - talent-2 cold, and the one-time escape freeze;
  - S1's strike, cold, push and spread;
  - S2's infinite attacks, snow damage, and cold on leaving;
  - S3's attraction, faster snow and attacks;
  - three 0-1 clears.
- `review-sbell2-public.mjs` passes 6 cases on both the candidate and the normal build.
