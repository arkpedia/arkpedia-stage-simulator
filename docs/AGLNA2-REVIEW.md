# Angelina the Mellow Wish review

Angelina the Mellow Wish (`char_1015_aglna2`) is a Skywalker Specialist. Her foundation was extracted after the extractor gained effect-only token support: `token_10071_aglna2_agairp` has no Spine art. The art receipt is `source-reviews/aglna2.json` in SD.

From data (tables and her own templates):
- **Trait.** The generic Skywalker: she blocks flying enemies while lifted off.
- **Talent 1** (`aglna2_t_1[enemy]`/`[self]`). Her attacks add `atk_scale_lo` × ATK Arts, or `atk_scale_hi` on enemies of weight up to `mass_level`. While she is lifted off, enemies in her range are weightless.
- **Talent 2** (`aglna2_t_2`). While she is deployed, lifted-off allies gain ATK `atk`, and `hp_recovery_per_sec_by_max_hp_ratio` of max HP a second while blocking.
- **S1.** Passive: lifted off from deployment, with range `3-6`, +ATK and `attack@max_target` targets.
- **S2.** Range `3-10`.
  - She glides for `chant_duration` s, levitating the ground enemies in range for `buff_duration_levitate` s and ground-binding the flying ones for `buff_duration_ground_bound` s.
  - Then she attacks with base attack time −0.8, +ATK, and `attack@max_target` Arts targets.
- **S3.** It holds `attack@trigger_time` ammo and can be stopped at any time.
  - She is lifted off, with +ATK and `damage_resistance` against damage from flying enemies (ba.airprotect).
  - Her range is `3-9` plus the eight surrounding tiles.
  - Attacks hit `attack@max_walk_target` + 1 targets for `attack@atk_scale` Physical.
  - Flying enemies in range are slowed by `move_speed`.
  - With an unblocked flier in her original range and nothing blocked, she moves (ba.addash) onto its tile.

Declared mappings:
- **Ground-bind.** Per ba.groundbind ("目标变为地面单位，无法移动", halved above weight 3), a flier becomes walk-moving and immobile for the duration.
- **S2 glide.** The glide affects the enemies in her skill range at its start.
- **S3 extra target.** The extra target is not forced to be a flier.
- **Effect-only token.** The effect-only token is not drawn.

Validation:
- `test/arkpedia-aglna2.test.js` (37 cases) covers:
  - stats, cost and SP at every rank;
  - S1 liftoff, the weightless field, and the Arts riders by weight;
  - the blocking regeneration;
  - S2's glide without attacks, levitation and ground-bind, and the Arts volleys;
  - S3's slow, the move, air protection, and the ammo end;
  - three 0-1 clears.
- `review-aglna2-public.mjs` passes 6 cases on both the candidate and the normal build.
