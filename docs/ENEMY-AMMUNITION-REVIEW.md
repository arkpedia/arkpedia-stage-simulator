# Enemy ammunition

Pathfinder Sagittarius, Artifex, Ballistarius and Nuncio, including their elite variants, share a bounded
ammunition account and projectile transport. Ballistarius starts with two rounds;
the other three start with one, all with no
natural refill. Native `enemy_spmode_check` selects the charged attack before
an attack; the unsilenceable expenditure consumes one round. Reload adjustments
clamp to the account capacity. Charged payloads retain their mode after spending
the round, reloading, or the source dying.

Sagittarius uses double ATK for the charged Physical projectile; ordinary shots
use normal ATK and an empty, blocked Sagittarius attacks directly in melee.
Artifex always uses Arts projectiles and its charged shot also applies Burn
buildup equal to 150% ATK. Ground-only selection, speed-10 transport, five/ten
second projectile lifetimes and source-independent released shots come from
retained native components. The elemental payload follows accepted HP hits,
including shield absorption, and rejects dodged hits through the common damage
receipt. Stage-specific damage multipliers are declared explicitly and do not
alter the shared record, ammunition cost, or capacity.

Ballistarius fires speed-4 Physical shells into a three-by-three area while
loaded, then uses direct melee attacks until refilled. Its base/elite charged
ATK scales are 1 and 1.25. Veles uses a speed-10 Physical projectile, with native
Gelato tag priority. Both reuse one independently unmissable, fixed Arts bonus
for recipients tagged `TAG_TRAP_WPNSTS`; unrelated buildings do not qualify.

Nuncio uses the same melee/ranged mode controller and an Arts projectile at
150% ATK. Its database-resolved, missable `disarmed` effect carries Disarm and
Silence for 15 seconds (base) or 10 seconds (elite). Ordinary status handles
share removal, honor resistance, and prefer recipients without the original
buff key. Shielded accepted hits carry the status; evaded hits do not. Its
Gelato bonus shares the fixed Arts path. The pinned buff database is retained
once alongside the enemy source evidence.

Tests exercise all ten records, Silence, charging exclusions, reload clamping,
mode persistence, blocked melee, elemental shielding/evasion/source death,
stage-local scaling and rejection of changed native contracts. GA-1 through
GA-5, GA-EX-1/2 and their challenges are developer-only additions with browser
and complete-wave receipts. These are behavior and execution checks; ordinary
attack animation-marker timing, native projectile effects and exact Unity
attack-finish ordering remain separate fidelity work. Ammunition expenditure
uses the simulator's common completed attack hook.

Enemy ammunition pips render directly from the shared account. A browser check
verifies both filled and emptied states on GA-EX-1. Actual two-second refills
come from [Gelato Stops](CAPTURABLE-STAGE-DEVICES-REVIEW.md); ammunition is not
silently replenished by an unrelated global timer.

Dessert Vendor and Street Corner Vendor share a three-round account and the
same route-following summon controller. Their unsilenceable skill spends one
round, releases a Snack Cart after the original Skill animation attack marker,
and hands its short delay to the battle scheduler. Released children survive
the vendor's death, inherit its remaining route, and count toward wave
completion. Stun before release cancels the summon without refunding ammunition.
Slow-down affects the cast and cooldown. Their ranged Physical projectile and
250% direct melee strike use the common damage and projectile pipelines.

Snack Cart and Luscious Snack Cart permanently arm when blocked while not
Silenced. An interrupted attack does not explode. The armed attack releases at
the retained animation marker, deals fixed Arts damage to the surrounding
three-by-three area and blocker, applies independent fixed Burn to ordinary
recipients, and kills the cart. Gelato Stops receive replacement fixed Arts
damage without Burn. Killing an unarmed or interrupted cart does not trigger
this attack. The four skeleton clock records reference one original art bundle;
no copied sprite or animation assets are introduced. Re-extract or verify them
with `ARKPEDIA_PYTHON=/path/to/python node tools/arkpedia/snack-animations.mjs`.
These clocks improve release timing; they do not certify native rendering or
all client-frame ordering.

The GA-EX5 challenge's +350 fixed cart blast damage uses a declared additive
parameter. It leaves the shared enemy record, device damage and Burn unchanged.
Unknown parameters and unreviewed mixtures of addition and multiplication are
rejected before stage publication.
