# Anti-Armor Infantry

Both infantry variants share `singleGrenadeInfantry`, one verified projectile
definition and the normal melee engine. They aim at ground targets, release a
double-ATK Physical grenade after 0.5 seconds, and damage eligible units in the
retained 3×3 box at impact, including flying units. The speed-5 projectile survives
the source's death. The source's original 53/30-second attack animation uses its
own clock; attack speed does not shorten the grenade cast, while Slow Down does.

The attack-event hook creates a non-silenceable, non-stunnable buff. Its separate
1.14-second timer switches to melee, restarts the combat state and adds +200%
movement speed. Control before release leaves the grenade unspent; after release
it cannot cancel that independent transition. Ordinary melee attacks return to
base ATK. The second form uses the original `*_B` clips on the same skeleton.
The regular actor accepts a reviewed movement alias alongside its existing idle,
attack and death aliases, without changing shared model data.

Admission validates both native modes, selectors, attack hooks, buff arithmetic,
transition template, projectile geometry/transport and original animation
events. The generic multi-skeleton extractor retains both clock records in
`data/arkpedia-infantry-animations.json` from `refs/arts/enm_art_7.ab`:
`enemy_1143_merrpg=3336140457337311868` and
`enemy_1143_merrpg_2=4525594408198859883`.

Tests cover one-shot ownership, ground aiming versus mixed-motion splash, the
transition clock, melee-only targeting, movement, silence, interruption, Slow
Down, source death and negative source mutations. Rendering tests verify that
movement and attack aliases share one model and restore the base roles.
PS-5, its challenge, and WD-4 have browser-start and complete wave-schedule
receipts; raised-life no-deployment sweeps are diagnostic, not playable clears.

Remaining limits include native collider/contact precision, ordinary melee frame
alignment and exact compiled-FSM retry scheduling after interruption. These
admissions do not certify client-frame or full visual parity.

The current shared SD snapshot does not yet contain these two enemy bodies.
Browser gameplay therefore uses labelled fallback markers. The native clocks
and B-form aliases are retained and tested, but a loaded original infantry model
has not been visually approved. The controlled WD-4 browser receipt explicitly
records that limitation.
