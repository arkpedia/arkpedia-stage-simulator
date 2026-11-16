# Redmark Eradicators

Both Redmark Eradicator variants now use a shared marked-target melee/projectile component. A native global selector finds ground targets carrying `storm_ally_mark`, excluding `redman_exclude`. A blocker takes precedence and receives native melee at 30% of the source's ATK. Unblocked attacks release a single speed-16, ten-second physical projectile; a released projectile survives source death.

The native `C_Attack` clip lasts 70/30 seconds and releases at 43/30 seconds. `C_Combat` lasts two seconds and releases at 24/30 seconds. The ordinary cast sequence captures the selected deployment and mode, cancels unreleased damage under control/death, and shares the existing projectile transport. Invisibility uses the existing core behavior: blocking lifts it, and unblocking starts the native three-second restoration delay.

Global targeting is a runtime profile flag. `enemyAttackRadius` supplies the same range to attack execution and combat-state checks, while stored base statistics and portable component parameters remain finite. Local and global marker filters now share one source contract and one runtime selector setup; Expletive uses these helpers too. The ordinary melee packet contract now accepts an explicit source scale instead of assuming every melee mode deals full ATK.

Source admission checks the root/mode, marker/tag/ground selector, direct and projectile packets, 30% melee scale, stealth checker and buff, original aliases/event clocks, and projectile lifetime/source-death policy. Both original bodies retain their native `C_` aliases; the source-bound artwork extraction option resolves their Idle/Move/Attack roles without manufacturing clips. Their skeletons/textures differ, so no model alias is used. Artwork is pinned to asset commit 2376832a83d3ba1f2774dec81192e01a048c4dfd.

The focused regressions cover 101 cases. Desktop/touch fixtures verify unmarked rejection, global marked shots, native melee scaling, released shots hitting after source death, and stealth returning after three seconds. The projectile becomes observable at the end of the simulator step, so its recorded presence can be one tick after its native release marker. Both native bodies decode and render all six clips. These are isolated actors on compiled 0-1 geometry with injected sandstorm markers, not original-stage clears.

Original sandstorm production, native particles/audio, parabolic visual height and exact callback/frame ordering remain outside these fixtures. The original stages remain gated until their controllers are implemented. Combat admission increases from 730 to 732 enemies (797 database levels); existing stage graphs remain pinned until the stages phase.

All 970 published stage graphs pass ten-second runtime smoke. The broad suite has 1,801 passes, three skips and only the same two known Chimera failures. Neither check certifies playable stage clears or native frame parity.
