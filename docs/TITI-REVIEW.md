# Titi review

Titi (`char_4056_titi`) is an Incantation Medic. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/titi.json` in SD.

From data:
- **Trait and ordinary attack.** Her ordinary attack deals Arts damage, with the hit at the Attack clip event (0.5 s). Each hit heals one ally in range for `scale` (50%) of the damage. The table's `heal` attack kind is overridden to Arts, as the trait text says.
- **Talent 1 (E1+).** She can attack sleeping enemies (`hitSleep`). Each hit on a non-moving enemy deals an extra `extra_atk_scale` × ATK as Arts. While she is deployed, every sleeping enemy takes `damage_atk_scale` × ATK as Arts each second.
- **Talent 2 (E2).** Minos and Sargon operators above `hp_ratio` HP gain `attack_speed` ASPD (vigor). This includes Titi herself, who is Sargon. The battle now keeps a `regularNations` map.
- **S1.** +ATK. Each hit has an `attack@prob` chance to put the target to sleep for `attack@sleep` seconds.
- **S2.** She stops attacking and gains +ATK. At the start, she and the operator in her range with the lowest HP ratio fall asleep until the skill ends. Enemies around both are kept asleep, and talent 1 is multiplied by `talent_scale`. She can stop the skill manually while asleep.
- **S3.** +ATK and two targets. A hit on a target that isn't asleep puts it to sleep for `attack@sleep` seconds. When any enemy on the field wakes, it takes Arts damage scaled by how long it slept. When a sleeping enemy wakes or is killed, one other enemy within `range_radius` falls asleep for `sleep` seconds. When an ally in her range takes fatal damage, it is left at 1 HP and asleep.

Declared mappings:
- **Non-moving.** An enemy counts as non-moving when its `moving` flag is false at the moment of the hit.
- **S2 enemy sleep.** Enemies within 1 tile of her and of her slept ally are put to sleep, refreshed every second.
- **S3 wake damage.** The scale rises linearly from `min_atk_scale` to `max_atk_scale` over 5 s of sleep.
- **S3 fatal-hit sleep.** An ally slept by a fatal hit wakes when the skill ends, or at full HP. In this engine, sleeping units are excluded from heal targeting, so only untargeted healing can wake it early.

Validation:
- `test/arkpedia-titi.test.js` (39 cases) covers:
  - stats, cost and SP at every rank;
  - the Arts hit, its ally heal and the non-moving bonus;
  - hits on sleepers and the per-second sleeper damage;
  - the vigor threshold;
  - S1 sleep, S2 sleep with its manual stop and the ×3.3 talent, and S3 sleep, wake damage and fatal-hit sleep;
  - three 0-1 clears.
- `review-titi-public.mjs` passes 6 cases on both the candidate and the normal build.
