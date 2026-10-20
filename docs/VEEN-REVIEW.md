# Viy review

Viy (Вий, `char_4226_veen`) is a Mystic Caster. His source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/veen.json` in SD. The site names him by the asset name "Viy".

From data (tables, his own templates and projectile prefabs):
- **Trait.** Mystic: Arts attacks. With no target he stores one energy per attack interval, and his next attack fires them all. He holds up to `times` units, and every `merge_cnt` merge into one transposed energy. The owner replaces the generic Mystic store/release.
- **Talent 1.** Merging needs this talent; without it he stores `merge_cnt` singles. While he holds a transposed energy he gets ATK `atk`; otherwise ASPD `attack_speed`.
- **Talent 2** (`veen_t_2[damage]`, `_merged`). Attacks and fired energy put `attack@value` Arts per second on the target for `attack@duration` s, stacking to `attack@max_stack_cnt`; a transposed energy adds `merge_cnt` stacks. He does not target enemies that carry it.
- **S1.** Automatic ASPD.
- **S2.** Base attack time −0.5. Every attack or fired energy stacks `veen_s_2_buff[stack]` ATK/ASPD up to its `max_stack_cnt`; a transposed energy adds `merge_cnt`.
- **S3.** ASPD. Each fired energy (`projectile_chr_veen_s3`) first hits at `attack@base_atk_scale`, then bounces once to another enemy for `attack@bounce_atk_scale`, preferring the enemies hit least, `attack@delay` apart. A transposed energy bounces `merge_hit_cnt` times. The skill holds `attack@trigger_time` ammo: one per energy, `merge_cnt` per transposed. It ends when the ammo is spent and can be stopped at any time.

Declared mappings:
- **Transposed energy.** It is one projectile dealing `merge_cnt` × ATK.
- **Targets.** Fired energies all strike his attack target; in S3 the bounces then spread.
- **HUD.** It does not show S3's remaining ammo.

Validation:
- `test/arkpedia-veen.test.js` (39 cases) covers:
  - stats, cost and SP at every rank;
  - storing to nine units with merging and the talent buff;
  - the release, with a transposed shot at 3× ATK and three damage-over-time stacks;
  - damage-over-time ticks, and skipping a marked enemy;
  - S1 ASPD;
  - S2 stacks and their cap;
  - S3 bounces, ammo and the end;
  - three 0-1 clears.
- `review-veen-public.mjs` passes 6 cases on both the candidate and the normal build.
