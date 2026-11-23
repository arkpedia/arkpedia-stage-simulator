# Trimounts City Defender and Captain

Two melee guards whose attacks take away Block:
- **Trimounts City Defender** (`enemy_1326_cbagen`): 5,800 HP, 400 ATK, 150 DEF, 40 RES, attack interval 1.5, move speed 1.2, weight 1.
- **Trimounts City Defender Captain** (`enemy_1326_cbagen_2`): 7,800 HP, 500 ATK, 170 DEF; otherwise the same.

The City Defender alone blocked CW-1 "Dense Fog". The Captain is in no published stage yet.

Both are admitted from their pinned CN prefabs and the Global buff templates. `shared/arkpedia/enemy-city-defender-features.js` holds the contract. It pins:
- the record (stats, both silenceable ability texts, the ReduceBlockCnt talent, no skills);
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the `enemy_cbagen_t_debuff`, `_tile` and `_normal` templates;
- the Attack clip clock from `refs/arts/enm_art_13.ab`: 1.13 s, hit at 0.5 s.

The runtime is `server/sim/content/arkpedia-enemy-city-defender.js`, kind `cityDefenderBlock`.

`talent:ReduceBlockCnt` is also the Agent's key. `enemy-reactive-features.js` dispatches `covers`, `ability` and `explains` to this contract for both City Defenders.

## ReduceBlockCnt

The talent is silenceable. Its ability adds `enemy_cbagen_t_debuff` to every attack target for `duration` (3 s). At its start the debuff checks the target's current tile and derives one buff under the shared override key `cbagen_t_debuff` (EXTEND):
- **On a Gravity Switch** (`tile_grvtybtn`): `enemy_cbagen_t_debuff_tile`, BLOCK_CNT FINAL_SCALER `tile_block_cnt` (0). Block becomes 0.
- **Elsewhere:** `enemy_cbagen_t_debuff_normal`, BLOCK_CNT ADDITION `normal_block_cnt` (−1). Block is reduced by 1.

**Repeated hits.** A further hit extends the one debuff to 3 s; it never takes a second point of Block. If the operator's tile changed between hits (Gravity Switch or not), the debuff is replaced by the other branch.

**Silence.** A silenced City Defender still attacks, but its hits apply no debuff.

## Verification

`test/arkpedia-city-defender.test.js`:
- **Admission.** Both variants are admitted. Each of these is refused:
  - another tile key;
  - a MULTIPLIER normal branch;
  - the tile branch reading `normal_block_cnt`;
  - a talent that is not silenceable;
  - a different `normal_block_cnt`.
- **Normal tiles.** A 3-Block operator drops to 2 on the first hit and stays at 2 through further hits. Block is back to 3 seconds after the last hit.
- **Gravity Switch.** On a Gravity Switch the operator's Block is 0.
- **Silence.** While the City Defender is silenced, its hits leave Block alone.
- **Compiled CW-1.** The City Defender has 5,800 HP and 400 ATK. Blocked by a deployed Myrtle, its hits debuff her and cost her 1 Block. No battle errors.

The library rebuild published CW-1 (1,025 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures. The browser review passed, and CW-1 loads in the preview with no console errors.

## Boundaries

- **FINAL_SCALER.** `tile_block_cnt` is read as the final Block multiplier (0 gives no Block), as the ability text says. Jetman's attribute-modifier FINAL_SCALER was read as one plus the value; the two readings meet only here, and both match their texts.
- **Parent override type.** The parent debuff's `overrideType` 3 is read as "extend the existing one". The derived buffs say EXTEND by name.
- **Tile change during the debuff.** The tile is checked at each hit only, as the native start node does. No CW stage published so far has a Gravity Switch.
- **Presentation.** The debuff effects are not reproduced.
