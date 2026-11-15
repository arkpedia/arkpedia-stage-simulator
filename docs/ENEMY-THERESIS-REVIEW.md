# Theresis narrative encounter

The original enemy_1276_telex actor is Theresis. He is nonattacking,
invulnerable and unblockable, with zero Life Point cost on exit. The local
untargetable flag maps the handbook's cannot-be-attacked outcome. His scripted
skill becomes ready fifteen seconds after spawning and selects only the original
ground Kal'tsit identity, char_003_kalts. Other identities cannot lure the attack.
Without an eligible Kal'tsit the skill remains ready and does not cast.

The original Attack clip lasts 5.5 seconds and releases at 97/30 seconds.
The shared timed-cast controller owns the movement lock and Slow Down clock.
A shared piercing wave uses the captured bearing, speed five, lifespan five
seconds and original .5-radius collider. Swept circle tests include the ordinary
ally body radius, preserve contact order and hit each deployment at most once.
The wave crosses walls and can hit ground and airborne bystanders. It survives
source departure. Its InstantKill payload uses the core kill path, preserving
existing rebirth handling rather than manufacturing a large damage number.

The skill's original 999-second cooldown is retained. The ordinary chapter
encounter fires once because Kal'tsit is defeated and the stage ends well before
another cooldown. The code does not infer a generic once-only skill from the
handbook description.

This also admits the original stage override setting the Rot Eater's guaranteed
percentage to exactly one. It uses the existing literal-parameter validator and
a fresh per-stage record. Other new percentage values and cap changes remain
rejected; the canonical catalogue remains at .2/.8.

Source checks cover the original passive, target identity, cast, zero ATK/life
cost, lethal action, straight movement, collider and animation binding. Captured
two-dimensional bearing, untargetability projection, root-board collision and
stable contact tie order are local mappings. Native particles/audio, compiled
method ordering and original-client frame parity are not certified.

The initial combined suite passes 210 tests. Focused checks include no-target
behavior, the lethal wave, flying bystanders, source death and rebirth. A further
controlled run of original 11-17 keeps its starting Life Points, emits one slash,
defeats the pre-placed Kal'tsit and resolves the entire wave schedule without
runtime errors. All 919 compiled stages pass ten-second smoke checks.
The original body passes four desktop/mobile clip checks, and the desktop
gallery was inspected. Enemy admission reaches 691 of 2,163.

Reference: https://arknights.wiki.gg/wiki/Theresis/Enemy
