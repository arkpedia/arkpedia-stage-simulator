# Manual stage devices

Stun Generator (`trap_002_emp`), Detector (`trap_005_sensor`), and Command
Terminal (`trap_008_farm`) use one manual
device controller and one inspection/activation panel. Device identity includes
the original ID and tile, so several instances have independent accounts. Their
source tables, range grids and native prefabs are retained once in
`arkpedia-device-source.json` and `arkpedia-device-native-source.json`.

Original placed level and selected skill rank are preserved on each compiled
instance. The importer refuses hidden instances, scheduled activation, custom
skill/talent overrides and unsupported ranks instead of ignoring them. An
explicit `content refresh stage ID --devices` previews replacement of existing
device records; `--apply` writes the reviewed result under the same source-hash
and catalogue lock checks as rule refreshes, retaining map artwork and visibility.

Stun Generator charges five SP and costs ten DP. Its native fixed .75-second
release samples the 3x3 range and hits ground enemies, including invisible and
normally untargetable enemies. Damage is Arts through the normal source-owned
pipeline; the separate seven-second stun respects immunity and resistance.
Attack strength comes from the placed level: level 10 deals 1000 before RES.
The fixed ability finishes and consumes the device; it cannot spend again.

Detector charges fifteen SP, reveals ground and air enemies in the original
25-tile diamond for twenty seconds, and resumes charging after expiry. Entering
and leaving targets update continuously. Each instance removes only its own
reveal contribution. SP does not recover during either active ability. These
devices occupy their tile, cannot normally take damage, and consume no operator
deployment slots. Manual withdrawal UI is not included in this review.

Tests cover source digests, changed native contracts, level interpolation,
SP/DP admission, delayed targeting, damage/air exclusions, withdrawal, reveal
cleanup/overlap, and original-instance validation. Browser checks exercise real
tile clicks and activation buttons. Full wave receipts use raised life and do
not claim playable clears. Device presentation currently uses the shared
fallback actor; original device animation/effect and exact controller end-event
parity remain separate work.

Command Terminal retains its native building tag and enemy-targetable category.
It has 5000 HP, 100 DEF, 10 RES, zero Block and zero deployment-slot cost. It is
excluded from ordinary friendly selection and healing; its own HP regeneration
bypasses the healing restriction. The permanent upgrade charges 120 SP, costs
20 DP, adds one deployment slot, +200% DEF, +20 RES and 10 HP/s regeneration.
The native `farm_s_1` template grants the slot on buff start without a finish
reversal, so destroying an upgraded terminal retains that slot. `farm_t_1`
deducts one life point exactly once when the owner finishes. Terminal tile
overrides last only while the unit exists and invalidate pathfinding caches
when installed or removed.

The shared enemy selectors opt in to targetable buildings; other device kinds
retain their existing exclusion. Real Marksman/Fanatic attacks, building
priority, Arts/physical mitigation, friendly exclusion, independent instances,
slot persistence, tile restoration and changed source templates are covered by
runtime tests. The same device panel displays permanent activation without a
fictitious countdown. The Siesta campaign remains blocked: two hidden terminals
are activated by scheduled level actions, which this static-instance review
does not yet execute.

PL-2 and its challenge version schedule all 53 enemies before the retained
legacy 300-second deadline, but no-deployment sweeps time out with four surviving
walkers. Their receipts record this result rather than claiming a clear. The
original level omits `maxPlayTime`; changing that fallback remains a separate
native-default review.
