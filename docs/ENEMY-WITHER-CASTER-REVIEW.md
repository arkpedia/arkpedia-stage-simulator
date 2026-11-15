# Sarkaz Wither Casters

The two original variants share one device-healing channel. Their records supply
the 5-second initial delay, 15-second cooldown, 8-second contact lifetime and
2% maximum-HP healing pulse. Selection uses injured enemy-side bodies with the
exact `trap_086_larva` identity, lowest HP ratio first, inside attack range.
Ordinary target-free does not exclude these devices; heal-free, allied targeting
restrictions and wrong identities do. Device admission remains separate.

The original half-second Begin clip precedes the Loop's OnAttack event at 10/30
seconds. A speed-ten link then delivers its first pulse on contact and subsequent
pulses once per second. The captured deployment survives range changes but not
removal or replacement. Silence and disabling control interrupt the channel;
external projectile removal also releases its locks. Normal completion uses the
original minimum recovery of approximately .667 seconds. Cooldown runs from
cast start. Cleanup restores any pre-existing attack restriction.

`enemyPulseChannel` owns the lifecycle, while each feature supplies selection and
payload callbacks. Gramophone Whisperers now use it too. Both use the existing
travelling pulse-link component; its contact lifetime avoids charging travel time
against the duration of the effect. No artwork or per-stage behavior is copied.

The native contract retains the exact wrapper, selectors, healing template,
projectile controller, animation bindings and events. The retained link keeps its
target; no full-HP finish action is present. The local implementation therefore
continues its bounded channel after reaching full HP. Public wiki descriptions
disagree on early full-HP termination. Ratio sorting, recipient maximum HP and
fixed-tick ordering are explicit simulator mappings, not compiled-method proof.
Ordinary attack animation clocks feed the existing stance model; this change
does not certify the engine's first-attack windup against the original client.
Native beam particles, audio and pixel/frame parity are not certified.

Six focused tests and 197 combined tests pass, including all supported enemy
spawn checks and the existing Gramophone regression suite. Both original bodies
decode all 16 clips on desktop and mobile; the desktop gallery was inspected.
The asset repository contains 3,762 complete models. Enemy admission rises to
686 of 2,163; stage compilation admits 909 of 3,892 stages.
