# Eyes of the Sankta: ammo theft

The two enemy variants now share the ordinary homing-projectile transport and
an impact payload that chooses between ammo consumption and Physical damage.
The original projectile travels at 10 tiles/second, expires at ten seconds,
and survives source death. Its ground-only ordinary selector respects concealment.
The original attack event supplies release timing through the shared clock index.

At impact, an active AmmoSkill with remaining rounds loses one round and takes
no damage. No attack, hit, SP or ammo-consumed event is fabricated for successful
theft. Inactive skills, other skill kinds and ordinary trait magazines fail the
check and receive the original 100% ATK Physical damage action. Ammo gained or
lost while the projectile travels changes the result. Silence does not disable
the payload. Its resource action is unmissable; fallback damage can be dodged.

`SkillRuntime.consumeAmmo` now owns external consumption, exhaustion and optional
consumption-event emission. It preserves the activation's external recovery
allowance. `onAmmoConsume` synchronizes a separate controller-owned account;
Lemuen's three skills implement that callback. New resource effects should use
this operation rather than editing `ammoLeft` directly. This does not replace
operator attack controllers' timing for their own accepted shots.

Admission checks both native payload branches, their exact ammo action, target
selector, projectile transport, zero direct damage scale and empty listener.
The emitted two-second native theft effect and audio are represented by the
existing generic steal cue; original particles/audio and sub-frame callback
ordering remain outside this validation.

Six focused tests and 148 regression tests pass, covering ordinary skills,
Lemuen's controllers, external recovery, shared projectiles, Dorothy and Prayer.
Both original bodies decode ten clips on desktop and touch; the desktop gallery
was inspected. The shared asset store validates 3,756 complete models, with 476
additional enemy artwork records in the simulator. All eight Sankta variants
are now admitted. Overall enemy coverage is 680/2,163; stage coverage remains
905/3,892 because other mechanics still block the affected maps.
