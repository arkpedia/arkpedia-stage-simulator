# Invitation to Wine: shared enemy families

Sinkingsand and Sharpedge now have a source-gated regular-stage feature, separate
from the older full-mode kit. Both start with four blades and an additive ATK
bonus. Each actual strike spends one blade. The final boosted strike retains its
bonus through the retained attack recovery, then removes it and resets the attack
interval for the native mode transition. It never accumulates permanent stacks.
Silence does not disable either the bonus or the fragment count.

The pinned Global record supplies +70% for Sinkingsand and +80% for Sharpedge.
Current PRTS lists +80% for both; this implementation retains the selected table
revision rather than silently changing Global values. Native prefab templates
establish the additive formula, four consumptions, mode transition and minimum
of one death fragment. The retained skeleton supplies the 1.333333-second attack
and 0.533333-second release. Control interruption ends the final recovery. Local
attack dispatch and its cooldown reset remain simulation-step mappings.

Clarity and Magnificence share a silence-immune timed cast: five seconds initial
cooldown, fifteen seconds between cast starts, and the original Skill animation's
0.7-second release in a 1.4-second clip. The triggered talent owns a three-second
invisibility aura. The talent's duration, rather than the separately serialized
skill blackboard duration, governs the aura. Both native variants and PRTS retain
that three-second talent behavior. Stun/freeze/sleep interrupt an unfinished cast;
an already released aura has its own lifetime.

The aura follows its bearer and affects other live enemy characters within the
two-tile radius recorded by the original enemy table and corroborated by PRTS.
Its serialized circle component has unit radius; the compiled range binding is
unavailable. Selection ignores recipient untargetability, matching the documented
same-side aura behavior. Blocking suppresses the recipient's invisibility and
unblocking restores it immediately. Leaving range, aura expiry and source death
remove only that bearer's contribution. Overlapping auras therefore compose.
Hidden source/recipient bodies are excluded. The reported original-client bug
that can leave a hidden bearer's aura permanent is not reproduced.

Blueflower and Scarletmist use the same attack-SP and homing projectile path.
They begin with three of five SP. Ordinary attacks add one, including while
Silenced; the next eligible attack spends five and uses the skill projectile.
The native five-second cooldown is independent of the attack interval. Both
Attack and Skill retain a 55/30-second clip and a 25/30-second release. The
shared ordinary attack pipeline does not certify the first native windup frame.

The unmissable projectile payload attaches one independent resistable effect.
It snapshots ATK at arrival, persists after source death, and deals sourceless,
unmissable Arts damage every second, starting immediately. Each four accepted
pulses adds 30% of the cached ATK, starting at 30%. Invulnerability rejects the
pulse and counter; shield absorption still counts. Independent applications
retain separate snapshots and timers. Resist shortens the original 20 seconds;
Slow Down scales that resistable lifetime but not the fixed pulse interval.
Expiry/removal cancels further work, including a pulse at the expiry boundary.
The generic ramping-effect helper owns this state in the recipient buff, with
no per-enemy timer or duplicate asset. The source template's infinite derived
buff is mapped to the documented finite 20-second effect; native compiled
parent/child duration propagation remains unrecovered.

All six enemies share a scheduler-owned fragment helper. It retains the parent's
remaining route and schedules each child within 0.7 seconds, with a seeded random
offset inside a one-tile square. Pending children hold battle completion. Killed
blade enemies produce one fragment per remaining blade, minimum one; lamp
bearers produce one lampstand; vase casters produce one vase. Escapes and source-hole falls produce none.
The shared displacement callback records fall provenance without removing kill
credit, so source-gated death abilities can distinguish falling from damage.

`enemy-wine-features.js` checks original modes, buffs, cast wrappers, selectors,
fragment templates and skeleton identities. `wine-animations.mjs` reads the six
skeletons from one checksum-pinned art bundle; it stores only event receipts,
not duplicate artwork. Tests cover native contract changes, actual strike damage,
mode cooldown reset, fragment counts/routes/offsets, completion holds, falls,
silence, interruption, live aura membership, blocking and overlap cleanup.

Stage receipts distinguish browser startup, controlled interactions and complete
wave/route sweeps. None establishes native visual parity, compiled callback
ordering or a playable clear. New stages remain developer-only.

References: [Sinkingsand](https://prts.wiki/w/沉沙),
[Sharpedge](https://prts.wiki/w/新硎), [Clarity](https://prts.wiki/w/清明),
[Magnificence](https://prts.wiki/w/堂皇), [Blueflower](https://prts.wiki/w/青花),
[Scarletmist](https://prts.wiki/w/赤霞).
