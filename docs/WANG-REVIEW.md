# Wang review

Wang (`char_2027_wang`) is a Trapmaster Specialist. His stones are `token_10064_wang_stone1`.
- His source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`.
- The owner art receipt is `source-reviews/wang.json` in SD.
- The stone's original Single skeleton is bound by `tools/arkpedia/cn-token-art.py` (`data/arkpedia-wang-token-art*.json`, SD `source-reviews/wang-stone.json`).
- Its 180×180 card avatar is bound by `cn-token-avatar.py` (`data/arkpedia-wang-token-avatar*.json`, SD `source-reviews/wang-stone-avatar.json`).
- Both were imported with the SD scripts `import-original-models.mjs` and `import-native-avatar.mjs`.

Generic addition: a `CN_OWNER_REVIEWS` entry may declare `tokens`. Token records then come from that owner's foundation, and their art and avatar receipts are checked by hash against `review.tokenArtwork`.

From data:
- **Trait and ordinary attack.** Trapmaster: traps are never placed on a tile with an enemy. His ordinary hit lands at the `Attack_1_A/B` events.
- **Stones.** The deck, cost and redeploy time come from the token record.
- **Talent 1.** He starts with `cnt` stones. A manual placement adds one more stone on an adjacent tile, at most `attack@max_spawn_cnt` per deployment, preferring an undeployable tile with an enemy.
- **Talent 2** (`wang_t_2[penetrate]`). A triggered stone gains `attack@per_atk_scale` damage and `attack@per_magic_resist_penetrate_fixed` RES penetration per stone on its continuous straight line, at most `attack@max_trigger_cnt` times.
- **Stone damage.** Stones use Wang's ATK (`CreateBuffUseHostAsSource`).
- **S1/S2.** Automatic: each gains `cnt` stones. Passively, a trigger applies:
  - S1 (`sktok_wang_1`): sluggish, and `atk_scale` × ATK Arts each second for `sluggish` s;
  - S2 (`sktok_wang_2`): `atk_scale` × ATK Arts and a `move_speed` slow for `duration` s, to enemies within `tile_count` tiles along the stone line.
- **S3.**
  - He stops attacking, and his range grows to `4-12`.
  - He gains `cnt` stones and places those over his limit onto enemies in range.
  - Stones trigger and strike in `x-6` for `sktok_wang_3` `atk_scale`.
  - During S3 a stone may be placed on an enemy's tile inside his range. The skill ends when stopped or when the stones run out.

Declared mappings (the native stone link system, `env_043_stone_trigger`, exposes no data):
- **Link and trigger.** A stone is active while an orthogonally adjacent tile holds another stone. An active stone triggers when a ground enemy stands on its tile (in S3, in its `x-6` area). A triggered stone is consumed and its piece returns to the deck.
- **Line.** The line count is the longer of the stone's horizontal and vertical runs. The S2 strip follows that run's axis.
- **Hold limit.** He can hold `cnt` + 1 stones: the talent text says "最多拥有8枚" at `cnt` 7.
- **S3 ammo.** It is not counted separately; S3 ends on a manual stop or when no stones remain.

Validation:
- `test/arkpedia-wang.test.js` (39 cases) covers:
  - stats, cost and SP at every rank;
  - the deck stock, DP, and the free neighbour;
  - linking, triggering, consumption and the returned piece;
  - S1 damage over time with the talent-2 multiplier and penetration;
  - the automatic gains;
  - the S2 strip and slow;
  - S3's overflow onto enemies, enemy-tile placement and the stopped attacks;
  - three 0-1 clears.
- `review-wang-public.mjs` passes 6 cases on both the candidate and the normal build. They cover placing stones from the card, with the original token art rendered, a linked trigger, and each skill.
