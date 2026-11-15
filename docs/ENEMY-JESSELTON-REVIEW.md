# Jesselton Miller

The original enemy_1516_jakill uses two source-reviewed forms, shared ordinary
animation sequences, shared projectile transport and the existing rebirth
lifecycle. His Jailer form has +50 RES, ranged Arts attacks and a prison-tag
exclusion. Three ordinary attacks charge the fourth cast, which targets two
eligible ground recipients and independently applies three seconds of Stun on
projectile impact. Native unmissable additive Stun is independent of damage
avoidance. Both projectile variants have speed/lifetime ten.

The first lethal hit cancels an unfinished attack and starts the four-second
C1_Die transformation. The shared rebirth path preserves one real defeat,
restores full HP and supplies temporary invulnerability, target exclusion and
movement suspension. The transition frees eligible prisoners through the same
callback and selector mapping as Recidivists. Killer form removes the Jailer
RES bonus and gains the source flat ATK/DEF/movement and base-interval modifiers.
It attacks its blocker with Physical damage. Its fourth cast uses two hits,
at the original C2_Skill marker and .2 source-clock seconds later, ignoring 60%
DEF. Control interrupts unreleased hits. The original first/second form attack
markers and literal body names are retained.

The pinned Global and CN level-one entries contain only enhance.atk=800 in
their talent list. This adapter explicitly overlays that selected override on
the pinned base-level parameters (including the four-second transformation,
+1,000 DEF and -1.5 base interval). Admission checks both the complete level-zero
list and the exact sparse level-one list. This is a bounded local parameter
mapping; the global enemy compiler's array-merge policy is unchanged. The
separate enemy_5055_dqkill remains blocked: its source has tracing selectors,
keep-alive and cannot-exit behavior which this controller does not implement.

Admission checks the two skill wrappers, form passives, selectors, attack
payloads, repeat timing, respawn settings, animation mappings, projectile
transport and original skeleton events. The once-only rebirth, charge timing,
ordinary core attack receipts, sparse-level overlay, source ATK snapshot fallback
and fixed-tick ordering are local mappings. Compiled-client ordering, extreme
ASPD animation caps, native particles/audio and frame/pixel parity are not
certified.

Seven focused tests pass, including both database levels, tag exclusion,
two-target Stun, interruption during transformation and repeated attacks, true
second defeat, and original MB-8's complete schedule under controlled kills.
The combined enemy/device suite passes 80 tests; all 955 available stages pass
ten-second constructor/runtime smoke checks. The original body passes twelve
clip checks on desktop and touch, and its desktop gallery was inspected. The
asset repository validates 3,779 complete models.

One reusable boss definition unlocks six stages. Admission reaches 702 of 2,163
enemies and 955 of 3,892 combat stages.
