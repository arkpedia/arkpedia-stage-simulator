# Originium Ice Crystal and shared device ranges

The pinned CN character, skill and range tables are verified against their Git
blob hashes by `tools/arkpedia/stage-device-source.mjs`. Selected original device
records, skills and shared ranges are retained once in
`data/arkpedia-device-source.json`; the source record retains complete-file
hashes. Adding another reviewed device extends the selected IDs without copying
range grids or assets into each stage.

`trap_010_frosts` uses `sktok_frosts`: automatic recovery/activation, initial SP 0,
cost 15, recovery 1/s and a 10-second Cold effect. Both its character and skill
use range `x-1`. The original range contains 13 tiles: the center, the surrounding
3x3 square, and four cardinal tiles two spaces away. The existing Originium
Altar used a five-tile substitute despite naming `x-1`; it now uses the same
original 13-tile grid. Its retained `sktok_ore` remains 500 True damage every seven
seconds to both sides.

The ice crystal applies Cold to deployed allies through the common status
pipeline. Overlapping pulses can produce Freeze; resistance shortens the status,
and Freeze immunity prevents the conversion without making the unit Cold-immune.
The device tile is rewritten as flying-only and non-deployable in a private
adapter copy, preserving the input geometry. [PRTS 源石冰晶](https://prts.wiki/w/源石冰晶)
corroborates the pulse, duration and tile rewrite. Native cast frames and special
untargetability interactions are not certified by these table/behavior checks.

Device identity now checks the key as well as the translated name. Only the
reviewed `trap_010_frosts` is admitted by the new ice-crystal entry. Its new-stage
preflight also reads the verified original level: one matching visible instance,
base phase/level/skill, no talent or skill-blackboard override, and no wave action
controlling its alias. Missing, duplicated, omitted, overridden or scheduled
instances remain blocked. The full original level blob and rule receipt are
included in the atomic publisher's source recheck. The same verified-level reader
is reused by stage-local enemy aliases.

Tests cover original source reproduction, boundary tiles, first pulse timing,
Cold expiration, overlapping Freeze, resistance, immunity, enemy exclusion, tile
rewrite isolation, and rejection of changed instance definitions. New stages
remain developer-only pending broader play and fidelity review.
