# Sankta self-fear and empty native helpers

Eight Sankta variants share one original one-shot HP checker and the same
ordered buff actions: multiply movement speed, then apply self-inflicted Fear.
The checker accepts HP at or below 50%, including HP lost without a damage hit.
Healing does not rearm it. Its speed buff is independent of the resistible Fear:
rejected or shortened Fear must not leave the target unblockable. Silence and
stun do not disable this passive checker; lethal HP loss does not activate it.

`oneShotHpTrigger` now implements the common threshold lifecycle. The existing
Waker buff retains its strict boundary and silenceable checker. The Sankta
adapter selects the inclusive boundary and uses the ordinary Fear status and
movement controller. Source admission checks the original toggle, threshold,
buff order, modifier formula, status database and Fear target-tile actions.
Simulation-tick polling and existing Fear pathfinding are retained; native
sub-frame ordering and exact path parity are not certified.

The Claws/Crawl variants' additional named helper carries only an infinite
`empty` buff with no attributes or actions. The shared auxiliary classifier now
accepts an unused duration key and a visual alias for this exact stateless form.
Finite buffs, selectors, status flags, modifiers and actions remain blockers.
This also admits three ordinary IS5 bodies and twelve captured-animal variants
whose retained native components satisfy the same contract. There is no special
per-stage implementation or manual list of supported map IDs.

Coverage rises from 659 to 676 enemies. The stage count remains 905: remaining
mode, enemy and device requirements still block the affected maps. The other
Sankta variants' ammo theft and Prayer skills remain unsupported even though
their shared self-fear trait is now verified.

Four focused tests and 189 combined feature, auxiliary and HP-checker tests pass.
All 905 available graphs pass the ten-second runtime smoke. Seventeen original
bodies pass desktop/touch galleries across 90 clips per viewport; thirteen use
explicit aliases to existing identical models. See `arkpedia-self-fear-review.json`
and `SUPPORTED-BODY-ART-REVIEW.md` for the source and validation checkpoints.
