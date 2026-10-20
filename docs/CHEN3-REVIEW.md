# Ch'en the Dawnstreak review

Ch'en the Dawnstreak (`char_1050_chen3`) is an Arts Fighter Guard. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/chen3.json` in SD.

From data (tables, her own templates and the original projectile prefab):
- **Trait and ordinary attack.** Arts melee attacks, with the hit at the Attack clip event.
- **Talent 1.** +ATK and +ASPD. Her attacks deal weakness damage (`common_weak_damage`, "根据目标防御力和法术抗性变更伤害类型").
- **Talent 2** (`chen3_t2`, `[timer]`, `[evade]`):
  - each second without taking damage adds a stack;
  - at `stack_time` stacks she heals a random integer `heal_atk_scale_min`..`max` % of ATK and gains one evade, which dodges the next Physical or Arts damage;
  - any damage restarts the count.
- **S1.** +ATK. Both `Skill_1_Loop` events hit, and struck enemies are silenced until the skill ends.
- **S2.**
  - SP is cleared.
  - She leaves the field invincible for the fixed 2 s (`[skill_not_available]`). In that window she slashes the nearest enemy in range `times` (10) times for `atk_scale`; a kill moves the slashes to the nearest other enemy and adds one (`[dead_listener]`).
  - She then moves onto the surviving target's tile (ba.addash), or returns if it isn't deployable.
  - From her return until the skill ends she keeps `[respawn_buff]` ATK and `prob` evasion.
- **S3.**
  - Skill range `3-12`. Up to `attack@max_target` ground targets are hit at the three `Skill_3_Loop` events.
  - At the start a sword wave (`projectile_chr_chen3_s3`: speed 1.5, life 10 s, ended with the skill) travels along her facing.
  - The wave bounces off high ground, impassable tiles and the map edge (`_changeDirectionWhenHit`, `_checkHitHighland`, `_checkHitMapEdge`). Its hit list clears on each bounce.
  - It hits each enemy within 0.25 once per leg for `hp_ratio` of current HP, as Arts, at least `projectile_min_atk_scale` × ATK.

Declared mappings:
- **Weakness damage.** It takes whichever of Physical (after DEF) and Arts (after RES) would deal more; a tie keeps Arts. A source-flagged enemy damage type is not modelled.
- **S2 slashes.** The ten slashes are spread evenly over the 2 s window. She is drawn off the field after `Skill_2_Begin` and `Skill_2_Disappear` (new renderer flag `mem.regularHidden`). A "deployable" tile is a melee or all-build tile that no other unit occupies.
- **S3 bounce.** A bounce reverses the wave's direction (all facings are axis-aligned).

Validation:
- `test/arkpedia-chen3.test.js` (39 cases) covers:
  - the prefab wave constants;
  - stats, cost and SP at every rank;
  - weakness typing against high RES and against high DEF;
  - the quiet heal and evade, and the count restarting on damage;
  - S1's second hit timing and silence lifetime;
  - S2's invincible away window, eleven slashes with a kill transfer, and the move with its buff;
  - S3's wave minimum and current-HP damage, bouncing, and the triple hits;
  - three 0-1 clears.
- `review-chen3-public.mjs` passes 6 cases on both the candidate and the normal build.
