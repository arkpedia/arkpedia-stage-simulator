# Legacy stage rules

Original per-stage receipts remain the source of truth; the shared compiler
normalizes reviewed legacy names into the existing runtime contracts. New stage
rules do not need a second combat implementation or copied enemy records.

## Deployment bans

Empty `cbuff_excluded` rules with operator profession masks and ALL buildable
mask prevent deployment while keeping the operator in the squad. The same check
covers manual deployment, support cards and skill-triggered redeployment. Squad
membership and squad talents remain intact. The preparation screen identifies
restricted classes; battle cards show LOCK and remain available for inspection.

This corrects the existing public challenge entries 0-4, 0-9, 1-9, 2-1, 2-2 and
2-6 and adds 5-7 Challenge to the developer catalogue. Challenge HP/ATK/DEF and
life-point rules are compiled at the same time. Class bans do not reuse the
separate `char_exclude` squad-exclusion contract.

Partial buildable masks and arbitrary token/trap bans remain blocked. The
separate `include_predefined` contract now handles 3-6 Challenge: both original
Detectors are source-checked and removed before construction. Their underlying
forbidden tiles remain unchanged. Unknown device families, supplied trap cards,
instance overrides, scheduled activation and ambiguous matching are rejected.

## Stat and recovery aliases

`cbuff_attribute` uses the shared character-attribute modifier contract. Source
profession and placement masks select each operator, summon or device by its
own identity. ATK/DEF/HP multipliers compose with existing combat buffs. The
source mask 12 in 3-5 Challenge selects Medics and Supporters; the imported
English description incorrectly names Defenders.

`global_cost_recovery_mul` multiplies the natural recovery interval, just like
`cbuff_cost_recovery`: scale 2 gives half the ordinary natural DP rate. Skill DP
is unchanged. 9-13's source interval multiplier 99999 is retained exactly; it
makes natural DP negligible over a battle, rather than inventing a zero value.
10-4 adverse still needs its hidden artillery-controller alias resolved before
its complete source rules can be published.

`ebuff_weight` reuses the additive enemy-weight contract (2-8: +2, 3-3: +1).
BH-4 Challenge uses a scoped +4 Crownslayer weight rule alongside a separate
Skullshatterer HP multiplier and global challenge modifiers. The compiler rejects
malformed selectors and fractional weights.

`cbuff_initial_cost` remains blocked. 0-6's source has `cost: 3`, while its level
and PRTS list initial battle DP 8. The rune name alone does not establish whether
this changes a card, battle budget or another quantity. No guessed override is
published.

Corroboration: https://prts.wiki/w/0-2_守卫 and
https://prts.wiki/w/2-8_不做约定 . Runtime tests cover live modifiers and selectors,
DP accumulation and unaffected direct DP gains, actual enemy weight, rejected
input, and both deployment paths. Per-stage wave/browser receipts describe their
limited diagnostic scope; they are not frame-parity or playable-clear approvals.

## Scoped enemy and device changes

Zero enemy talent multipliers remain subject to the feature's parameter
validator. 6-5 Challenge sets the selected Possessed enemies' periodic HP loss
to zero. 9-16 Challenge sets Purifying Flame's negative ATK modifier to zero;
its Arts hit, Burn and retirement are retained. Negative multiplier values and
undeclared parameters still fail. TG-3 adds 300 ATK to the two specified Metal
Crab records after its ordinary challenge multiplier.

CB-EX8 Challenge scales Command Terminal SP cost by 1.5 through the shared
manual-device controller, without changing initial SP, recovery speed or DP cost.
BW-8 Challenge adds 300 Turret ATK through the existing per-device stat selector;
straight-projectile impacts use that live ATK. Additive character rules are
currently restricted to the reviewed Turret ATK selector; operator modifier
ordering and other stats are not inferred from this case.
