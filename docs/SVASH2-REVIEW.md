# SilverAsh the Reignfrost review

SilverAsh the Reignfrost (`char_1045_svash2`, CN 凛御银灰) is a Tactician Vanguard. While he is deployed, his Eye of the Snowstorm card (风雪之眼) is in the deck. The card is the selected skill's `overrideTokenKey`: `token_10057_svash2_eagle1`/`2`/`3`, costing 16/14/19. His art receipt is `source-reviews/svash2.json` in SD. Each Eye's Default-only skeleton and its card avatar come from the CN client (`data/arkpedia-svash2-eagle{1,2,3}-token-{art,avatar}*.json`), checked by hash against the review's `tokenArtwork`. The Eye's skeleton has no idle clip (Start/Die/Idle are optional aliases it lacks), so its idle role is the literal `Default`.

From data (tables, his own and the Eye's prefabs, projectiles and templates):
- **Talent 1** (`svash2_t_1`, SortDeck on his deployment).
  - The deck is sorted by deployment cost.
  - He and the operators left of the Eye gain `sp` SP on deployment (`svash2_t_1[sp]`).
  - Their next redeployment time is ×`respawn_time` (`[resp]`, a ratio card buff).
- **Talent 2** (`svash2_t_2`, Global with tag kjerag, selfOption 2). Other Kjerag operators:
  - cannot be frozen;
  - gain DEF `def` and `hp_recovery_per_sec_by_max_hp_ratio` of max HP a second;
  - both are doubled (`[buff_double]`) once he has been deployed for `interval` s.
- **"Nearest" card.** It is the first match of three selectors (`svash2_s_1[deck]`): next to the right among Guards, Snipers and Casters; then next to the right; then next to the left.
- **S1** (auto). He gains `cost` DP. The nearest card costs `svash2_s_1[deck].cost` less, and its next deployment gains a barrier of `svash2_s_1[deck].shield` × his max HP.
- **S2** (manual, 2 charges).
  - Up to `max_target` enemies in range `3-7` take `atk_scale` × ATK Physical. They are cold for `cold` s and lose stealth for as long (`svash2_s_2[signal]`).
  - The nearest card costs `cost` less. The deck is then sorted.
  - Every operator card left of the Eye stores one cast, up to `max_stack_cnt`.
  - When that card is deployed, the operator casts the same area with its own ATK and no damage source: 1 s after deployment, then 0.4 s apart (`svash2_s_2[build_set]`, AOEDamage over `range_id`).
- **S3** (manual, `duration`).
  - Range `3-1`, and enemies in range lose stealth.
  - Each attack strikes every enemy in range for `bird_atk_scale` × ATK Physical, with ×`damage_scale` damage taken for `weak[limit]` s (`svash2_s_3[bird_on_self]`).
  - He gains `svash2_s_3[start_cost].cost` DP at once, then `svash2_s_3[cost].cost` every `svash2_s_3[cost].interval` s.
  - The first S3 of a battle swaps the base cost of the costliest card (Guards, Snipers and Casters first) with the cheapest card's, until each card's next deployment (`svash2_s_3[sort_once]`, `[deck_build]`).
  - The Eye is deployable during S3 (`eagle_valid`). The first operator deployed in S3 takes the Eye, and the Eye card moves it onto another deployed operator.
  - On his attack rhythm, the Eye strikes the enemies in that operator's `3-1` range the same way (BirdAttack_Ally, `[summon_bird]`).

Declared mappings:
- **Deck order.** While he is deployed the deck stays sorted by current card cost, stable by the original deck order, with the Eye after cards of equal cost.
- **Left of the Eye.** It is read from the sorted deck at the moment an operator is deployed. Deployed operators are not deck cards.
- **Moving the Eye.** Moving the Eye with its card costs no DP (its cost is refunded).
- **S3 strike.** S3's strike hits every enemy in the `3-1` grid of the striker's facing.
- **In-game checks for the owner.** Whether ties sort the same way in game, and whether the Eye sorts after equal-cost cards.

Generic changes:
- `battle.regularDeckOrder()` lets an owner order the deck. The app moves card buttons only when the order changes.
- A summon `config.deckMarker` shows its cost while it is not deployable.
- A summon `config.targetsAlly` card is placed onto a deployed operator instead of selecting it.
- `bench[id].baseCost` overrides a card's base cost until its next deployment.
- He opts out of `talentCostStat`, because his talent's `respawn_time` is a ratio for other cards.

Validation:
- `test/arkpedia-svash2.test.js` (41 cases) covers:
  - stats, cost and SP at every rank;
  - each skill's Eye in the sorted deck, and no sorting once he leaves;
  - talent 1 SP and the faster redeployment;
  - talent 2 DEF, regeneration, the doubling and freeze immunity;
  - S1 DP, discount and barrier;
  - S2 strike, discount, the two-stack cap and the 1.0 s/1.4 s deploy casts;
  - S3 DP over time, the once-per-battle swap, line strikes with fragility, and the Eye's first holder, card move and strikes;
  - three 0-1 clears.
- `review-svash2-public.mjs` passes 6 cases on both the candidate and the normal build. It checks that the DOM deck order matches the sorted deck, the marker Eye, the S1 discount label, the S2 stored cast from a UI deployment, the S3 swap on two card labels, and the Eye dragged onto an operator.
