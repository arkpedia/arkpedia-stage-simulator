# Derisive Audience

`enemy_2009_csaudc` uses the existing `elementOnHit` component. Each successful
ordinary melee hit adds 20% of current ATK as neural damage, independently of the
Physical packet's DEF mitigation. Missed attacks add no element damage. No new
per-enemy runtime controller or duplicated implementation is introduced.

Admission checks the pinned ordinary Combat component, neural element type,
empty attack buffs, passive blackboard converter, one ordinary mode, null skill
and skill-trigger references, empty general/common ability lists and the exact
record parameter shape. The database SP row has no attached native skill; it
does not create a charged attack. Mutating the elemental type, buffs, binding
strategy, ratio or skill-trigger reference rejects admission.

The original body and all five clips decode with finite poses on desktop and
touch-sized Chromium. The body is stored once in arkpedia-sd-assets at commit
`a9982d884786ebe04fc45e19318edb13c499c5d5`. The source inspector reads the same
hash-verified bundle and retains Combat sibling components through the shared
extractor's explicit scope mechanism.

Validation includes 190 combined feature/runtime/loading tests and a complete
controlled clear of the newly admitted individual IS stage
`isw-sp_level_obt_roguelike_ro1_level_rogue1_ev-3`. The clear removes enemies in the
test harness; it validates wave/dependency/lifecycle integration, not a player
strategy. All available graph entries also receive the ten-second runtime smoke.
This is not a native frame/pixel parity certificate.
