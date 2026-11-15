# Blade Helmet Knightclub enemies

The Trainee, Elite and Tytus Topola share a parameterized global stat-debuff cast controller
and the existing one-time rebirth implementation. Their original records differ
in stats and initial/repeat cooldown (25, 15 and 10 seconds). No duplicate artwork is
introduced: the animation generator reads all three skeletons from the same verified
art bundle and retains only clock evidence and source hashes.

The native AtkDesWeaken selector picks the highest current ATK, excludes the
same weakening buff from any source, and samples again at release. Its Skill_1
animation lasts 1.5 seconds and releases on the original 0.4-second marker.
Slow Down scales that cast, while the repeat timer uses elapsed battle time.
Stun or Silence cancels an unreleased cast. Targetability and camouflage use
the shared selector rules. Equal-ATK ties use the simulator's ordinary target
order; compiled native tie-breaking has not been verified.

The result is a final 50% ATK multiplier for 25 seconds. It is independent of
the caster after release, does not stack across sources, and is a stat modifier
rather than a damage packet or a Resist-shortened status. A second caster selects
another eligible unit instead of overwriting an existing weakening.

Ordinary attacks deal direct Arts damage to a ground target. Their shared native
Attack clip lasts two seconds and releases at 29/30 seconds, both divided by
the retained 1.4 animation speed. The ordinary attack pipeline uses these
windup/recovery clocks; this does not certify first-hit frame parity. The native rebirth
controller specifies one resurrection, five seconds of recovery and 20% HP;
the generic full-HP default is not used. Rebirth cancels the current cast and
resets the skill to its initial cooldown. The source's second-mode index has no
second mode in this prefab; the local implementation resumes the same behavior.

Admission checks the retained selectors, modifier formula, wrapper, global-range
component, animation binding, rebirth controller and exact parameter schemas.
Tests exercise release-time reselection, exclusions, source death, expiry,
interruption, Slow Down, direct attacks and single-use rebirth. MN-EX-2 and
MN-EX-7, MN-EX-8 and PS-6, including Challenge variants, remain in the developer catalogue.
Native visuals, exact compiled cooldown ordering and Unity frame parity are
not certified by these checks.
