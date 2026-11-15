# Imperial Artillery Targeteers

The base and Core Targeteer share a reviewed attack, selector, scanning visual
and projectile. Their records only describe flight; `native:imperialShell` makes
the omitted attack mechanics an explicit admission requirement. The prior base
entry's unconditional native-count exception is removed. Both scanning buffs
are attribute-free `empty` templates and are now checked by the existing
auxiliary-component classifier.

The retained attack selects a single ground or airborne ally, uses cached ATK,
and launches `projectile_enemy_emppnt` at a fixed position. Its native controller
waits three seconds, does not follow the target, survives source/target loss, and
has a radius-1.2 circle. It does not force a hit on the originally selected
unit. Collision ignores camouflage while retaining ordinary target restrictions.
The exact source definitions and hashes are in the native evidence file.

[PRTS 帝国炮火先兆者](https://prts.wiki/w/帝国炮火先兆者) additionally documents
static-body displacement exclusion, sourceless Physical damage, cached ATK, and
neutral-target preference at equal taunt. The native selector names
`mark_neutral[effect]`. Target sorting now offers a shared equal-taunt comparator;
this attack prefers that marker after taunt, before deployment order. It does
not fabricate neutral units or unblock stages whose NPC systems are missing.

`delayedAreaAttack` is shared by regular and Stronghold dispatch. It records the
position and ATK at launch, schedules one area pulse, and survives source death.
The regular base Targeteer previously used a generic immediate single-target
attack; it now uses the same delayed shell as the legacy kit. The stronger
variant is admitted after matching the same native predicates. No extra assets
or per-enemy simulation loop are introduced.

Tests check both variants, delay, cached damage, source loss, movement out of the
blast, camouflage/stealth/air handling, neutral-marker and taunt ordering, and
rejection of changed native attack or visual-only component semantics. Existing
Stronghold shell tests pass. Native attack-animation selection/release frames
remain outside this behavior certification.
