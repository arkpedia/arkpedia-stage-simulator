# Bellone review

Bellone (`char_4037_demetr`) is a Fighter Guard. His foundation was extracted after the extractor gained effect-only token support: his "Bond" marker, `token_10065_demetr_dmtpos`, has no Spine art. The art receipt is `source-reviews/demetr.json` in SD.

From data (tables and his own templates):
- **Trait and ordinary attack.** Fighter: blocks one enemy. Ordinary hits alternate the `Attack_A/B` clip events.
- **Talent 1** (`demetr_t1[def_dec]`, `[dmg_inc]`):
  - each hit lowers the target's DEF by `attack@def` for `attack@def_dec_duration` s, stacking to `attack@limited_stack_cnt` (`attack@s2_limited_stack_cnt` during S2);
  - his damage rises linearly with the target's missing HP, from `min_add_on_scale` at `min_hp_ratio` to `max_add_on_scale` at `max_hp_ratio` (`DamageScaleAccordingToHpRatio`).
- **Talent 2** (`demetr_t2[evade]`). Physical and Arts evasion starts at `init_prob` on deployment and falls by `dec_prob` a second for `trig_cnt` s.
- **S1.** Automatic; it fires on his next attack: two hits of `atk_scale`, at the `Skill_1` events.
- **S2.** Skill range `3-13`, +ASPD, and `attack@max_target` targets at `attack@atk_scale`. At full talent stacks the target is continuously sluggish.
- **S3.** +ATK/ASPD, with `prob` for an extra `prob_atk_scale` hit.
  - He picks a ground enemy and moves (ba.addash) onto its tile when it is deployable. He does this at the start, and again when the elite or leader he last attacked falls, or when he has dealt no damage for `time_stack` × `interval` s (`demetr_s3[target_timer]`/`[timer]`).
  - Fatal damage makes him UNDEADABLE, untargetable and unblocking, and ends the skill (`demetr_s3[undeadable]`).
  - He then returns to his original tile.

Declared mappings:
- **S3 search.** S3 picks the nearest ground enemy within 3 tiles of him, because the native `FlyToTargetSecond` selector range carries no fields. A "deployable" tile is a melee or all-build tile that no other unit occupies.
- **Bond marker.** The effect-only Bond marker is not drawn.

Validation:
- `test/arkpedia-demetr.test.js` (38 cases) covers:
  - stats, cost and SP at every rank;
  - the shred cap, and the missing-HP damage;
  - the evasion decay;
  - S1's double-hit timing;
  - S2's three targets and the sluggish at eight stacks;
  - S3's move, the fatal end and the return;
  - three 0-1 clears.
- `review-demetr-public.mjs` passes 6 cases on both the candidate and the normal build.
