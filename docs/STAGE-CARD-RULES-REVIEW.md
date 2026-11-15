# Stage deployment-card rules

Original `cbuff_char_cost` / `char_cost_mul` and `cbuff_respawn_time` /
`char_respawn_time_mul` runes compile into one list of scoped card attributes.
Each entry retains the original profession mask, buildable mask and positive
scale. Unknown masks, parameters and rune fields fail compilation. Explicit
`NONE` difficulty is inactive in both normal and challenge battles.

The profession bit order is Caster, Sniper, Medic, Supporter, Guard, Defender,
Specialist, Token, Trap, Vanguard. Compound masks remain compound masks; a
summon does not inherit its owner's class. Buildable selectors use the card's
placement class; ALL also includes devices whose source position is NONE.
The original receipts remain pinned and shared by normal/challenge bindings.

The deployment rune changes the initial cost before talent adjustments,
redeployment penalties and final card discounts. Selected operator records
retain their initial card attributes separately from talent-adjusted values.
Squad preparation can still apply Zima's cost adjustment without multiplying
it by the stage rule. SilverAsh the Reignfrost's cost swap reads these adjusted
base card costs. Sussurro's low-cost threshold uses the same base cost.
The PRTS [deployment-cost reference](https://prts.wiki/w/部署费用) corroborates
this order. Source records are not rewritten to represent temporary stage rules.

Operator card display/payment/refund use the common cost path. Summon decks
share `stageSummonCost` for card display, affordability, payment and refunds,
including the independent Ling, Magallan, Ela, Stainless and native token decks.
Supplied stage-device cards receive the scoped cost during compilation, so their
existing display and placement transaction read the same value. GT-HX-3
Challenge now supplies 15-DP roadblocks, as its original TRAP-only x3 rule requires.

Redeployment rules use `stageCardRespawnTime` at each actual operator/card
cooldown boundary, retaining own talent corrections and later cooldown ratios.
The source cooldown itself remains unchanged. Native tactical-point recovery
that uses a separate skill/blackboard timer is not a card redeployment timer.

`test/arkpedia-stage-card-cost.test.js` checks original masks, initial costs,
talent order, redeployment rounding/refunds, distinct operator/token classes,
and the payment and cooldown paths of five different summon implementations.
The existing operator/skill deployment sweep is supplemented during this review
with a stage using x3 cost and x2 redeployment time.

## Refreshing existing stages

`npm run content -- refresh stage <id>` previews the changed rule fields and
runs the same battle smoke gate as additions. `--apply` atomically replaces only
rules, battle parameters, compiled enemy records and supplied token cards.
It refuses changed geometry, rechecks original/local source hashes under the
content lock, preserves artwork and catalogue visibility, and records a receipt.
`--supplies` explicitly allows original supplied-stock count changes while
rejecting tile changes and every other supply-instance change. It updates the
geometry receipt together with the counts in the same atomic write. Global and
per-card stock modifiers compose once; zero-stock delivery cards are retained.
It is idempotent. New entries still use `content add stage` and enter the
review catalogue only.

The cost pass corrects thirteen existing stages and adds BW-2 Challenge and
OF-EX4 Challenge. The timer pass handles 4-8 Challenge and 5-5 Challenge. Browser
startup and no-deployment wave-schedule receipts are stored in each changed
stage; they do not certify a playable clear or exact native client timing.

The stock refresh corrects 1-6 Challenge to one initial roadblock. The original
`gbuff_placable_char_num` alias also restores R8-10 Challenge's five deployment
slots. 4-4 Challenge retains its doubled movement speed and accepts only the
exact neutral legacy `map_hp: 1` field; non-neutral unknown attributes fail.
