# Saint Statues

Saint Statue and Praying Saint Statue compose three existing runtime primitives:
`rechargingBarrierAura`, `passiveEnemyBody`, and `projectileSingleAttack`.
Native-only feature declarations can list several component identities, which
compile into ordinary schema-1 plan entries. There is no Statue runtime switch
or per-stage implementation.

Each source adds 2% of a recipient's current maximum HP every second to one
shared Physical/Arts barrier, capped at 50%. Multiple Statues contribute to that
same budget. Existing charge survives leaving range or losing the source, and
lower maximum HP does not discard charge already above its new cap. Statues and
Dream Tiles are excluded through their original markers. The center-based range
and common hidden/sleep selection rules are explicit simulator mappings.

The immobile body retains native control immunities and does not count towards
the wave total. It fires travelling Arts projectiles; released shots survive
source death. The source does not wait for an animation event, so the release
uses zero windup alongside the original zero-duration Attack clips.

Native admission validates the shield template's selector, exclusions, cap/add
math, shared buff ownership and Physical/Arts absorption. Cosmetic branches
cannot contain gameplay actions. The body review explicitly accounts for both
its gameplay Passive and the mode-local cosmetic Effect using the same strict
auxiliary-component classifier, without double-counting automatic claims.
Projectile type, speed, lifetime, source invalidation and extra-buff behavior
are checked against the retained original components.

Validation includes 215 combined tests, followed by 15 focused native/admission
checks after tightening reference and projectile roles. All 782 admitted database
levels pass serialized-plan comparisons and configurable-statistic invariants.
All 961 available stages pass ten-second runtime checks. A controlled browser
fixture loads only the three generic adapter groups, combines two providers,
then preserves charge after both sources die, without fetching the source
registry or compiler. That fixture is not an original-stage playthrough.

Both original bodies and all eight clips pass desktop/mobile pose and decoding
checks. Artwork is stored once at assets commit
`56c68862942f0ac809b810194bf37dc6b81aa0fd`. Original clocks are reproducible with
`ARKPEDIA_PYTHON=<python-with-UnityPy> node tools/arkpedia/saint-statue-animations.mjs`.
Particle effects and native frame/pixel parity are not certified. Coverage is
717 supported enemies and 961 available stages; other blockers remain in the
Statues' original stages.
