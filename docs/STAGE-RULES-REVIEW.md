# Original level rules

Each file in `data/stage-rules/` retains the original rune array, repository,
immutable commit, level path and SHA-256 of the complete downloaded level. These
are reviewed inputs to the compiler, not inferred from a translated description.

| Stage | Life | Enemy multipliers | Hidden group |
|---|---:|---|---|
| 5-4 Challenge | 1 | HP/ATK 1.05; DEF 1; movement 1.5 | none |
| PS-3 normal | unchanged | unchanged | `raid` inactive: 26 enemies |
| PS-3 Challenge | 1 | HP/ATK 1.1; DEF 1 | `raid` active: 32 enemies |
| SE-5 normal | unchanged | unchanged | `raid` inactive: 47 enemies |
| SE-5 Challenge | 1 | HP/ATK/DEF 1.2 | `raid` active: 48 enemies |
| SV-3 Challenge | 1 | HP 1.5; ATK/DEF 1.05 | none |
| SV-1 Challenge | 1 | HP/ATK 1.1; DEF 1; weight +3 | none |
| BW-1 Challenge | 1 | HP/ATK/DEF 1.2; weight +3 | none |
| OF-EX1 Challenge | 1 | HP/ATK/DEF 1.1; range 2 | none |
| SV-7 Challenge | 1 | HP/ATK 1.1; DEF 1; range 1.25 | none |

5-4 Challenge and SE-5 use the pinned Global source. PS-3, SV-1, SV-3 and BW-1 use the pinned CN
source because their original combat levels are absent from that Global revision.
The CN enum values retained here are difficulty `2` (FOUR_STAR) and buildable
mask `3` (ALL). Original aliases `gbuff_lifepoint` / `global_lifepoint` and
`ebuff_attribute` / `enemy_attribute_mul` have the same reviewed effects for
these levels. Numeric masks are accepted only for these reviewed values.

All newly added normal stages retain an original rule receipt too. A source
`null` rune list is kept as `null`; challenge-only effects remain inactive on
normal difficulty, even when their scoped behavior is not implemented yet.
5-5's respawn-time rule and LK-DP-B's scoped HP rule demonstrate that distinction.
Activating an unsupported rule still fails compilation. The audit compared
compiled runtime data before and after attaching these normal-stage receipts;
it did not change battle parameters, enemies, routes or waves.

The previous hidden-group helper appended all otherwise simple hidden entries.
That incorrectly included challenge-only enemies in normal difficulty. It now
requires an explicit boolean activation decision for every group. All entries
are validated before any mutation; unknown activation, branching, random packs
or invalid wave indices refuse compilation.

Tests exercise the actual stage compiler and battle stats, normal/challenge
enemy counts, unchanged source inputs, changed rule-file detection and rejection
of unknown keys or targeting. Existing public stage files are not automatically
rebuilt: the inventory exposes fresh-source blockers for separate review.

These additions remain developer-only. Browser/runtime and route sweeps do not
certify a playable clear, every interaction, visual fidelity or client timing.

## Enemy range rules

OF-EX1 retains `ebuff_attack_radius` with `range_scale: 2`; SV-7 retains
`enemy_attackradius_mul` with `scale: 1.25`. Both use the all-enemy targeting
masks and challenge-only difficulty. The compiler accepts those exact parameter
shapes and multiplies the configured enemy radius after level overrides. The
raw radius remains available to abilities that consume that source attribute;
melee ordinary attacks retain their zero effective radius and require a blocker.
Independent skill-blackboard radii are not rewritten by this attribute rule.

The range tests exercise ordinary attacks at distances between the normal and
challenge radii, either side of the existing ally-collider boundary, and after
a per-level range override. They also check melee blocker-only attacks,
unchanged normal difficulty and refusal of altered masks or parameter shapes.
Both variants have original level/table Git hashes retained by the rule importer.

## Explicit level time limits

The rule importer also retains the original `options.maxPlayTime` when present.
Compilation maps -1 to an untimed regular stage and preserves positive limits.
H5-3's original level sets -1 and schedules its final spawn after 321 seconds;
the previous unconditional 300-second runtime limit could never run that wave.
The regression test runs the complete 93-enemy schedule past five minutes with
no timer override (life is raised solely to isolate scheduling from leaks).

Older source schemas such as SV-7 omit this field; the receipt preserves that
omission and the runtime retains its existing 300-second default. Existing
public stage artifacts are not silently rebuilt. The simulator's separate
one-hour global execution guard still applies even to untimed source levels.

## Shared evidence and normal-stage restrictions

The importer now covers all combat levels in the pinned Arkpedia checkout.
Mode-only IDs are resolved as exact paths in the pinned Git tree, without
inventing stage-table aliases. Normal/challenge bindings reference shared,
content-addressed level evidence. Both files are checked before publication;
inline receipts remain compatible. Importing evidence never admits a stage.

OF-6 has a NORMAL-only Schwarz exclusion. It is enforced by the squad/support
pickers and the battle constructor, which also rejects a conflicting fixed
squad. This motivated making original evidence mandatory for normal stages.
IW-EX2 Challenge's literal enemy-ID selector scales only its four parent enemies;
their spawned fragments retain ordinary stats. Regex/unknown selectors fail.
Known EASY/SIX_STAR rules are inactive on normal/challenge stages, while unknown
difficulty masks still fail. This does not implement those other modes.

FA-3 Challenge reduces deployment capacity by one through
`global_placable_char_num_add`. Initial-DP additions use the same strict integer
budget path. OF-EX5 Challenge's `cbuff_cost_recovery` scale 3 multiplies the
recovery interval: natural DP becomes one third, matching its “66% slower”
description. Direct DP grants are unchanged. Tests exercise actual deployment
rejection and timed DP accumulation, and reject invalid budgets and masks.

## Attack speed and initial tokens

`ebuff_attribute`/`enemy_attribute_mul` now map `attack_speed` to base ASPD.
OF-EX3 Challenge supplies a multiplier of two; real spawned enemies have twice
the ASPD and half their ordinary attack interval, with unchanged base attack
time. This does not change independently timed skill casts.

`cbuff_token_initial_cnt` is a signed addition to the named stage-supplied token
card. OF-EX6 Challenge's `trap_001_crate=-6` changes twelve roadblocks to six.
Compilation updates a private geometry copy before generating cards, ensuring
the UI and runtime stock agree. Missing/duplicate targets, unsupported token
identities, fractional counts and negative results are refused. Zero removes
the card. Tests deploy all six roadblocks and verify the seventh is rejected.

`enemy_talent_blackb_mul` and `ebuff_talent_blackb_mul` use explicit pipe-separated
enemy IDs and positive numeric scalars. Each implemented feature declares the
parameters it allows a stage to scale; unsupported parameters remain blockers.
AF-6 Challenge changes only Agent Leader's block-reduction duration from 10 to
20 seconds. IW-EX1 Challenge doubles only `enemy_1195_sfyin`'s death-spawn count
from two to four. Global records and other parents' counts stay unchanged.

## Reviewed enemy skill cooldowns

The original global `ebuff_skill_cd` rune composes as a multiplier, but timed
enemy skills must opt in through a reviewed feature validator. Canonical skill
records remain unchanged for native-source validation; runtime parameters carry
the stage multiplier. Unknown timed skills fail compilation. 1-8 Challenge
applies 0.35 to Crownslayer's initial and repeat 15-second Blink clocks, yielding
5.25 seconds. Attack intervals and attack-SP skills remain separate. Tests
exercise the actual first and repeated blocked blink, and reject unreviewed
skills rather than silently scaling their timers.
