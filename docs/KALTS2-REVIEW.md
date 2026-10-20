# Kal'tsit - Esperanta review

Kal'tsit - Esperanta (`char_1052_kalts2`, CN 凯尔希·思衡托) is a Watchman Medic. Her S3 places a tactical anchor (`token_10068_kalts2_mtship`). Her art receipt is `source-reviews/kalts2.json` in SD. It is the first two-page Spine atlas in SD: `cn-owner-art.py` now verifies one material and texture per atlas page, in page order, and accepts the mirror's habit of dropping only the first page's `size:` header line. The anchor's model and card avatar come from the CN client (`data/arkpedia-kalts2-mtship-token-{art,avatar}*.json`), checked by hash against the review's `tokenArtwork`.

From data (tables, her own and the anchor's prefabs, projectiles and templates):
- **Trait.** She heals allies and can lift off.
- **Talent 1** (`kalts2_t_1`).
  - Max HP and DEF `max_hp`/`def`, block +`block_cnt`.
  - Block radius +`block_radius_scale` (`block_radius_scaler[inf]`, BLOCK_RADIUS_SCALE addition).
  - She lifts off after deployment and her block mode is FLY (ChangeCharBlockMode): she blocks fliers only.
- **Talent 2** (`kalts2_t_2`). An operator (profession mask 639) entering her attack range gets:
  - `hp_recovery_per_sec` HP a second for `buff_duration` s, ×`rhodes_bonus` for Rhodes Island (`[hp_recover]`);
  - unless it still holds one from her, a shield that blocks one damage instance of any type (`[shield]`: BlockDamage with no mask, then FinishBuff).
- **S1.** ATK `atk`, ASPD `attack_speed`. Every other lifted-off ally gains block radius `attack@block_radius_scale` (Aura, selfOption 2).
- **S2.** `attack@trigger_time` ammo, range `y-11`, manual stop, ATK `atk`.
  - Each attack fires a medical unit (speed 12): at an enemy when one is in range (AttackEnemy), otherwise at an injured ally (HealAlly).
  - On impact, enemies within the 1.5 radius take `attack@atk_scale` × ATK true damage, and allies within it are healed `attack@heal_scale` × ATK.
  - The enemy shot also leaves them sluggish for `attack@sluggish` s (its `_activeBuffs`); the heal shot's damage half has none.
- **S3.** ATK `atk`, base attack time `base_attack_time`, one more heal target, and one anchor card (`kalts2_s_3[token_ctrl]` RechargeToken `cnt`).
  - The anchor goes on a ranged tile outside her attack range (token description), costs its source DP and takes no damage.
  - When it is born she flies to it (StartTransporting, `projectile_chr_kalts2_s3_2` speed 3.5) with her skill progress locked.
  - 0.6 s later (`kalts2_s_3[withdraw]` first trigger), up to two operators in her `y-6` range (S3OperatorSelector, max 2) are withdrawn. Their cards are free (`cost_scale` 0), need no redeploy wait (`ignore_respawning_state`), and can be placed only inside her attack range (the extra buildable checker) until their next deployment or the end of S3.
  - On arrival the anchor is withdrawn and she is moved onto its tile with its facing (MOVE_LIKE_RESPAWN_SELF, RespawnBorn), keeping her HP ratio and the rest of S3. No second anchor is granted.

Declared mappings:
- **Talent 2 entry.** An operator counts as entering when it was not in her range on the previous tick. While S2 runs, the S2 range is her range (`kalts2_t_2[s2]`).
- **S3 extra target.** "额外治疗1个目标" is read as max targets 2.
- **S3 selection.** S3 picks the two operators nearest to her. Withdrawn operators get no DP refund.
- **Flight.** In flight she is hidden, untargetable and cannot act, and a marker follows her path.
- **Anchor.** The anchor takes no deployment slot.
- **Unmodelled.** `Kalts2S3ApplyPunishBuff` (S3 interrupt) has no data body and is not modelled.

Generic changes:
- A `blockRadiusScale` buff mod widens `Battle._checkBlock`'s contact radius by (1 + scale). A widened ground radius may reach a diagonal neighbour.
- `StandardBattle.regularPlacementDeny[id]` lets an owner refuse tiles for a card. It mirrors `regularPlacementAllow`.

Validation:
- `test/arkpedia-kalts2.test.js` (38 cases) covers:
  - stats, cost and SP at every rank;
  - talent 1 (liftoff, block, wider air radius, no ground block);
  - talent 2 (regeneration, the one-hit shield, no repeat while she stays in range);
  - S1's radius aura;
  - S2's heal and true-damage shots with sluggish and the ammo end;
  - the S3 anchor rules, the locked timer, withdrawal, free cards refused outside and accepted inside her new range, the landing, and one anchor per cast;
  - three 0-1 clears.
- `review-kalts2-public.mjs` passes 6 cases on both the candidate and the normal build. They cover the anchor card drag with a facing swipe, the flight, and the transported card refused outside and accepted inside her range.
