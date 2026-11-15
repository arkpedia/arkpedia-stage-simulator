# Directional enemy protection

Fatty's three original levels and the CN variant share one reviewed native
prefab, one behavior controller and one set of skeleton clocks. Its native
templates explicitly compare tile columns for frontal protection: same-column
sources do not qualify. Physical and Arts damage from the protected side loses
80% after normal mitigation. True damage and damage without a source bypass it.

The common damage pipeline now evaluates directional and flying-source
Sanctuary alongside ordinary Sanctuary, selecting the strongest applicable
reduction. It does not multiply multiple Sanctuary instances. Existing flying
protection retains its exported helper and regression coverage.

Fatty starts facing right and checks operator positions every 0.3 seconds,
counting untargetable and airborne operators and excluding summons/devices.
Equal left/right counts retain the current facing. The renderer reads this
authoritative facing instead of inferring it from movement. The enemy cannot
attack or be blocked and its original life-point value is zero.

The native two-mode controller distinguishes normal and backward walking.
Opposite horizontal movement enters backward mode; matching movement exits it;
vertical movement retains the mode. Only backward mode runs the 30-second Show
timer, and mode changes reset it. Show plays the retained 3.833-second Special
clip with Slow Down and stops movement during that local cast. Stun interrupts
the cast. Backward movement uses the same skeleton's Move_2 clip.

The source gate checks the mode listeners, original buff templates, reduction
formula, profession mask, polling interval, animation binding and parameter
schemas. The logging-only common ability is classified separately. Tests cover
facing, ties, targetability, source types, overlapping protection, timer reset,
interruption, blocking and escape. These are standalone battle behaviors;
campaign reward settlement remains a mode dependency, and no Integrated
Strategies stage is enabled merely because this enemy is supported. Compiled
controller scheduling and client-frame parity remain unverified. Published
behavior is also documented in [PRTS's entry](https://prts.wiki/w/%E5%9C%86%E4%BB%94).
