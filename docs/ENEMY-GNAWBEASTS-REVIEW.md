# Gnawbeasts through shared charged damage and buff clocks

Gnawbeast and Starving Gnawbeast now compose one reusable
`chargedMeleePeriodicLoss` component. Their source skill recovers one charge
from an ordinary attack and spends it on the next attack. Silence suppresses
bleed application while the charge cycle continues; noSp prevents recovery.
The physical hit still uses the common damage pipeline. Dodged hits do not
attach the effect, and Token/Trap bodies receive no operator-only bleed.

The attached `blood_dec` effect loses 20 HP per pulse for Gnawbeast and 30 for
the elite. Its five-second lifetime has a short first delay and one-second
subsequent intervals. HP loss bypasses barriers and invulnerability and gives
no hurt SP. Healing and source death do not remove it. Shared EXTEND behavior
retains one existing instance and pulse clock when it is refreshed. The buff
clock now accepts a first-tick delay; no per-target timer queue is created.
The charged-attack helper retains its prior defaults for existing users.

Admission checks the original ordinary/charged melee components, attack-SP
record, skill wrapper, output-damage payload, silence/profession filters,
fixed-loss flags and templates. The original native Attack event and duration
are retained. Both original bodies are published once in the shared asset
repository at `cf5e98b2a8b97dc7f3fecacc4c2feb285b39e64a`. Desktop/touch gallery
review decodes all ten clips and shows both intact bodies.

Coverage increases from 717 to 719 enemies and from 969 to 970 combat stages.
TG-S-1 becomes available on regeneration through shared capabilities, without
a stage-specific script. It loads and restarts on desktop and an 844×390 touch
viewport, selecting four enemy groups and no legacy enemy/device catalog.
Controlled browser checks verify both charge cycles and five sourced HP-loss
pulses, including persistence after the source dies.

All 209 focused integration checks pass. The 19-test admission run also passes
and includes overlapping family cases. All 970 available stages pass ten-second
smoke checks. The broad suite reports 1,801 passed, three skipped and the same
two baseline Chimera pollution failures.

The controlled browser fixture is not a full TG-S-1 clear. The native bleed
particle loop, exact Unity callback/collision ordering and cross-source
priority beyond the shared EXTEND contract are not certified here.
Evidence: `data/arkpedia-gnawbeasts-review.json`.
