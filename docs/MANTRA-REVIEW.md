# Mantra review

Mantra (`char_4204_mantra`) is a Primal Caster. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/mantra.json` in SD.

From data (tables and her own templates):
- **Trait and ordinary attack.** Primal Caster Arts attacks, with the hit at the Attack clip event.
- **Talent 1** (`mantra_t_1`, `palsy_prob_retain`). Whenever an enemy's palsy triggers, it takes `atk_scale` × ATK elemental damage (元素伤害) from her. With `prob`, the triggered layer is kept.
- **Talent 2** (`mantra_t_2[cast]`/`[make_palsy]`, TileListener). Enemies appearing at the spawn point nearest to her get one palsy layer.
- **S1.** Automatic; it fires on her next attack: `atk_scale` Arts with `ep_damage_ratio` of the damage as neural injury, plus `element_atk_scale` × ATK elemental damage on a target in a neural burst.
- **S2.** Base attack time −0.8. `attack@atk_scale` Arts, then `chain_times` jumps of `attack@chain.atk_scale`. Each hit carries `attack@ep_damage_ratio` neural injury, plus `attack@element_atk_scale` elemental damage on a target in a burst.
- **S3** (`mantra_s_3[self]`/`[ally]`/`[enemy]`/`[enemy_trigger]`). Skill range `3-17`, +ATK and `attack@max_target` targets.
  - Enemies in her range lose stealth, and their palsy cap drops to 2.
  - When an operator in her range starts a skill (her included), enemies in range get `per_active` palsy, at most `max_trigger_cnt` times.
  - Every layer over the cap launches an element hit of `atk_scale` × ATK through the enemy and `chain_times` others. One launch fires every `interval_projectile_trigger` s.

Declared mappings:
- **Jumps.** Chain and overflow jumps go to the nearest other enemy within 1.7, 0.15 s apart (the template's "short interval").
- **Overflow cap.** External palsy grants are clamped to the general cap of 3 before S3's cap of 2 applies, so they can overflow by at most one layer.

Validation:
- `test/arkpedia-mantra.test.js` (38 cases) covers:
  - stats, cost and SP at every rank;
  - the palsy-trigger elemental damage, and spawn-point palsy;
  - S1's Arts, injury and burst bonus;
  - S2's chain over three distinct enemies, with injury;
  - S3's skill-start palsy, the cap and the overflow jumps;
  - three 0-1 clears.
- `review-mantra-public.mjs` passes 6 cases on both the candidate and the normal build.
