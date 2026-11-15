# Mire terrain and Gloompincers

Mire now has one accumulator shared by the existing mode and the lightweight
stage loader. Original tile contact triggers immediately, then every second.
Operators lose 5 ASPD per layer. Enemies also lose 5% movement speed per layer;
enemies at weight 3 or above gain two layers per trigger. The default cap is ten.
Leaving, becoming airborne or losing eligible tile contact clears the effect.
Mire immunity preserves contact while preventing both penalties.

The original controller and tile prefabs, five action templates and skill table
are retained with checksum-pinned sources. `stage-mire.mjs` checks exact reviewed
graph digests and matches the original map to exported coordinates. It accepts
one initially active controller and finite, bounded overrides for its four
numeric parameters. Scheduled controllers, unknown parameters, overlapping
controllers and mismatched tiles remain blocked. The simulator polls contact
and cleanup every 0.1 seconds; exact native frame order is not certified.
Character entry contributes `locate_on_tile_mire` to the shared result counters.

Swamp Gloompincer and its elite variant share a source-gated passive: permanent
Mire immunity and a 30% movement bonus while in Mire. The bonus is independent
of unrelated slows, survives silence, and clears when contact ends or the unit
becomes airborne. The source checker polls at 0.1 seconds. Both original body
models use exact prefab/animator/skeleton bindings in the shared model store.

Tests cover light/heavy enemies, operators, first and subsequent triggers, cap,
exit/re-entry, airborne/hidden/target-free recipients, death, immunity, unrelated
slows, silence, original overrides, map mismatches and source drift. The original
FC-1 controller compiles, and a controlled StandardBattle fixture verifies the
runtime installation and outcome counter. FC-1 itself remains blocked by Reeds
and its unsupported enemies. This change does not claim full Firelight coverage.

The checkpoint has 629/2,163 admitted enemies and 827/3,892 loadable stages.
All 72 focused integration tests and all 827 ten-second stage smoke checks pass.
Desktop and touch browser fixtures verify the entry penalty, counter and exit
restoration. Shared artwork commit `0508f057490cce733a77a15733f3570fd09a8191`
(local, not published) passes 93 tests and validation of 3,690 models. Both
Gloompincers decode all ten combined animation clips on desktop and touch; their
idle bodies were visually inspected. The artwork registry has 417 enemy entries.
