# Hoshiguma the Breacher review

Hoshiguma the Breacher (`char_1044_hsgma2`) is an Arts Protector Defender. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/hsgma2.json` in SD.

From data (tables, her own templates and the shield projectile prefab):
- **Trait and ordinary attack.** Her ordinary attacks deal Arts while a skill is active. The hit lands at the Attack clip event.
- **Talent 1, 我执** (`hsgma2_t_1`, `[heal]`, `[heal][interval]`):
  - at 0 HP she enters a minus-HP state and is not a heal target (HEAL_FREE);
  - damage keeps accumulating, and she falls only at `max_minus_hp_ratio` × max HP;
  - after `[heal].interval` s without damage she recovers `[heal].hp_recovery_per_sec_by_max_hp_ratio` of max HP per second, and leaves the state above 0 HP.
- **Talent 2, 坚忍** (`limit_bonus[atk]`, `[magic_resistance]`). ATK `min_atk` and RES `min_magic_resistance`, scaling linearly from nothing at `max_hp_ratio` to full at `min_hp_ratio`. The bonus is also full in the minus-HP state.
- **S1.** Automatic and charged by damage taken. Once it starts it lasts forever, giving +ATK/DEF. Every damage from an enemy returns `atk_scale` × ATK as Arts to it (`hsgma2_s_1`).
- **S2.** Automatic; it fires on her next attack. That is a three-hit attack at the `Skill_2_Loop` events on every blocked enemy, for `attack@atk_scale` each. A shield then circles her once (`projectile_chr_hsgma2_s2`: radius 1.0, 90°/s, 365°). Each enemy it touches gets, every `interval` s (`hsgma2_s_2[projectile]`):
  - sluggish for `sluggish` s;
  - `shield_atk_scale` × ATK Arts;
  - a heal for her of `heal_ratio` of the damage, which ignores HEAL_FREE.
- **S3.** Skill range `x-2`, +max HP, +ATK and `attack@max_target` targets. A manual stop starts `[before_dead]` for `before_dead_duration` s:
  - her bonuses stay, and she is UNDEADABLE and silenced;
  - her attacks hit four times;
  - allies in her range are UNDEADABLE, and their overflow damage is dealt to her as Pure;
  - when it ends, she is forced out as defeated.

Declared mappings:
- **Shield contact.** The shield touches enemies within 0.5 of it, because its range grid carries no fields. She keeps attacking while it circles.
- **S3 hits.** An S3 attack hits twice at its clip event, or four times in `[before_dead]`, cycling the `Skill_3_Loop_A/B/C` clips.
- **我执 form.** The Front skeleton's `B_` clips, which the Back file lacks, are the 我执 form. On the Front face, idle and ordinary attacks use `B_Idle` and `B_Attack` while she is at or below 0 HP.

Validation:
- `test/arkpedia-hsgma2.test.js` (40 cases) covers:
  - the prefab shield constants;
  - stats, cost and SP at every rank;
  - the minus-HP pool, HEAL_FREE, the 200% fall and the quiet regeneration exit;
  - berserk scaling;
  - S1 starting from damage, lasting forever, the Arts attacks and the returns;
  - the S2 throw, and the shield's sluggish, damage, healing and single turn;
  - S3's max HP and the manual last stand: protected allies, her survival, then her forced defeat;
  - three 0-1 clears.
- `review-hsgma2-public.mjs` passes 6 cases on both the candidate and the normal build.
