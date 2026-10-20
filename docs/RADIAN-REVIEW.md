# Raidian review

Raidian (`char_4195_radian`) is a Summoner Supporter. Each skill selects its own tower: `token_10051_radian_tower1` (S1, melee Physical blocker), `token_10052_radian_tower2` (S2, melee bullet tower) and `token_10053_radian_tower3` (S3, ranged Arts). The foundation was extracted after the extractor learned to record token skill prefabs that are absent from the skills bundle. His art receipt is `source-reviews/radian.json` in SD; each tower's original model and card avatar come from the CN client, with recipes and receipts in `data/arkpedia-radian-tower{1,2,3}-token-{art,avatar}*.json`, checked by hash at build time against the review's `tokenArtwork`.

From data (tables, his own and his towers' templates, and `projectile_chr_radian_tower2`):
- **Trait.** Summoner: Arts attacks, and he uses summons.
- **Talent 1.** `cnt` summons, at most the token's `maxDeployCount` on the field; the tower is the one the selected skill names (`tokenBySkill`).
- **Talent 2.** His summons gain inspiration of `atk`/`def`/`max_hp`.
- **Every skill.** The skill start gains one summon.
- **S1.** Raidian and his summons gain DEF `def` and a barrier of `hp_ratio` × max HP until the skill ends. Tower 1 blocks and strikes Physical.
- **S2.** Tower 2 keeps firing piercing Physical bullets forward (speed 5, life 0.6 from the projectile prefab). While S2 runs, Raidian and his summons gain ATK `atk`, towers fire two extra bullets, and bullets live `attack@projectile_life_time` (two tiles further).
- **S3.** Tower 3 strikes Arts. A tower with no target joins the target of another Raidian summon in its range (prism link). While S3 runs, Raidian and his summons gain ATK `atk`, and their damage leaves enemies sluggish for `sluggish` s and Arts-fragile by `damage_scale` for `weak[magic][limit]` s.

Declared mappings:
- **Inspiration.** Applied as the matching percentage of the summon's own stats.
- **Bullets.** A bullet hits each enemy it passes once (within 0.5 tiles). S2's two extra bullets fly along the neighbouring lanes.
- **Slots.** Summons take no deployment slot. Tower placement asks for a facing, which tower 2's bullets use.

Generic changes:
- `REGULAR_SUMMONS` entries can name `tokenBySkill`; `summonRecordFor` picks the selected skill's token, and `regularTokenIdsFor` lists all of them.
- `CN_OWNER_REVIEWS` declares the three towers, so their records come from Raidian's own foundation.

Validation:
- `test/arkpedia-radian.test.js` (39 cases) covers:
  - stats, cost and SP at every rank;
  - each skill's own tower, the five summons, and inspiration on placement;
  - S1's Physical blocker, DEF, barrier and one more summon;
  - S2's piercing bullets and the three longer-lived lanes;
  - S3's Arts hits, the prism link, sluggish and Arts fragility;
  - three 0-1 clears.
- `review-radian-public.mjs` passes 6 cases on both the candidate and the normal build. Each case places the skill's tower from its card with a facing swipe, sees an ordinary tower hit, starts the skill from the button with one more summon, and retreats with the towers cleared.
