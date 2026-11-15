# Surfing Instructors

Full Metal and Amalgam Surfing Instructors reuse the conditional Sanctuary
component already used by Bionic Power Armor Drivers. The helper now accepts its
source buff key, optional suppression key and silenceable binding. Its default
parameters preserve the existing driver behavior. The helper lives in a small
shared module, so selecting an Instructor does not import driver-specific code.

When unblocked, normal/elite variants reduce Physical and Arts damage by 50%/75%.
Blocking removes only their own Sanctuary immediately; unblocking restores it.
True damage remains unchanged and overlapping Sanctuary uses the strongest
source. The native binding is silenceable, while the database grants silence
immunity. Ordinary silence is refused; a forced silence flag disables the
binding. Stun does not remove its non-stunnable protection buff.

The native cart collision template explicitly checks these two prefab IDs. The
shared `isCartStoppingEnemy` predicate retains that relation, including
stage-local aliases through their source prefab. The Instructor has no invented
cart attack or aura. Self-Driving Carts remain unadmitted until their collision,
turning, equipment and lifecycle controller is implemented. Thus cart stages do
not become available merely because the Instructor is now registered.

Native admission checks the Arts melee Combat, block-count checker, passive
buff, non-stacking Physical/Arts damage mask, record parameters and cart identity
filter. The shared handbook wording is explained separately by each native
family's talent, preserving the existing Power Armor Driver registrations.

Validation includes 202 combined tests and a controlled complete wave clear of
DC-3, followed by 24 focused tests after extracting the shared helper. All 780
admitted database levels pass compiled-plan comparisons. All 961 available stage
graphs pass ten-second runtime smoke. Both original bodies and all ten clips
pass desktop/mobile decoding and pose checks; artwork is stored once at assets
commit `37e5e03ac6d1f96a92f2c58a4fc7a87c3492b500`.

This does not certify compiled native frame or pixel parity, nor the unimplemented
cart controller. Coverage is 715 supported enemies and 961 available stages.
