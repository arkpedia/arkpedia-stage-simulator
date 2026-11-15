# Realigned Flux

One stage-owned field serves Tuba devices, allied SP recovery and enemy target
conditions. Original Tuba instances preserve direction and reject unreviewed
level/skill overrides. They consume no deployment slots and cannot be damaged
or withdrawn. Source evidence is retained once in the shared device artifacts.

Operators redirect the beam toward their deployment facing; targetable summons
receive connection benefits without redirecting it. Unchanged path prefixes
retain their creation order, so a redirected extension cannot overwrite an
existing beam at an intersection. Removing a source or redirector releases the
old suffix and allows blocked beams to extend. Bounds and ownership terminate
loops. The implementation uses tile-centered membership for moving enemies;
exact native continuous-boundary and client-frame parity remain unverified.
PRTS corroboration: https://prts.wiki/w/“低音号” .

The stage-global environment uses original blackboard values. Most Lingering
Echoes stages subtract 0.5 natural SP recovery and restore 0.5 on connection;
LE-EX-2 restores 1.5 instead, giving 2 SP/s before other modifiers. No per-stage
controller or duplicated visual assets are needed.

Street Layabouts/Drunks add 40% ATK Arts damage to targets outside Flux. Street
Performers/Musicians add one Physical hit. The latter use the original homing
projectile (speed 10, lifetime 5 s). Connection is evaluated at impact. Bonus
damage has its own miss/mitigation handling and grants no second defensive SP;
Silence does not disable these native additive buffs. Released shots survive
source death. The original templates classify even the bow's bonus as MELEE;
that classification is retained separately from its ordinary ranged hit.

Mass-Produced and Enhanced Mass-Produced Colossi occupy two block slots. Flux
subtracts their original flat DEF/RES values (-1000/-50 or -1200/-50); leaving
removes the modifier, and Silence does not suppress it. Their ordinary melee
attack uses the existing enemy attack pipeline.

Spire Casters fire at two targets. An unconnected primary receives its ordinary
Arts hit and causes an additional Arts hit in the eight surrounding tiles;
the primary is excluded, and the splash grants no defensive SP. Violinists
prefer connected targets before taunt and release forward/backward projectiles
through connected units, each dealing 50% ATK with normal defensive SP.
Propagation queries the current shared route at each impact; released
projectiles survive source death and expire without forcing a remote hit.
Native projectile selectors are retained by reference, including their sibling
components, so changed direction or target contracts fail admission.

Overlapping splash application ordering, multiple hosted units on one tile,
and native frame/first-attack timing remain unverified. Animation metadata
uses original clips; the common enemy attack pipeline still controls attacks.

Resonators stop incoming beams while charging at 1 SP/s. Charge is retained
when the beam disconnects. At the original 20-SP threshold the device withdraws,
freeing the tile; a deployed operator or targetable summon can then emit a new
beam. Summons use their retained native facing-choice declaration; those without
a facing choice emit left. Simultaneously charging devices read one shared field
snapshot, avoiding enumeration-dependent extra charge. The UI shows charging
state and marks activated tiles without adding copies of device artwork.

Field Casters summon an uncounted Crimson Formation at the selected target's
tile, preferring Flux targets and excluding tiles already occupied by a
formation. The formation survives its caster, stops Flux from entering its own
and four neighboring tiles, and disappears after ten seconds or five damage
instances. Ground allies on its tile receive an independently owned stun and
Arts damage beginning at the native 0.9-second interval, then every second,
without defensive SP. Leaving or destroying the field removes only its stun.
Overlapping exclusions retain independent owners. Original source immunity and
hit-count behavior reuse the standard status and damage pipelines. Uncounted
summons do not hold victory open, but retain ordinary targeting priorities;
“non-primary target” is a victory condition, not an attack-priority modifier.
Zero-ATK payload attacks are an explicit shared targeting option.

Stun-resistance/cleanse interactions with the native aura's derived-buff lifetime
remain unverified. Local stun duration uses the shared resistance pipeline;
the periodic damage account remains attached until departure or field removal.
This behavior is covered by local lifecycle tests, not native frame comparison.
PRTS corroboration: https://prts.wiki/w/“谐振器”,
https://prts.wiki/w/残党阵地术师 and https://prts.wiki/w/血红阵地 .

Native prefabs/templates gate registration. The ten ordinary Flux enemies and
two Field Casters retain their Attack clocks in family animation receipts from the
verified CN art bundle. Their original Spine bodies are now supplied by the
shared SD repository, along with the two Saxophonists. Crimson Formation uses
a native non-Spine body which is not yet rendered. Original Flux VFX remain
unimplemented. The visible beam is a functional geometry overlay,
not an original-effect fidelity claim. Direction math now lives in one shared
module with the old simulation import retained as a compatibility re-export.

Tests cover source mutations, intersections and changed-path priority, loops,
redirection, summons, retreat, SP values, projectile timing, cancellation,
source death, Colossus armor and block weight, splash selection and defensive
SP, curved projectile propagation, disconnection and lifetime expiry. Browser startup, controlled
redirection and full no-deployment wave checks are recorded on stage receipts;
these checks are not playable clears or overall fidelity approval.

## Remnant Saxophonists

Both variants share one cardinal-projectile controller. The native skill starts
with ten seconds of cooldown and repeats on a twenty-second account, including
casts with no nearby target. Begin, Loop and End clips come from the original
art bundle; the local sequence releases four shots at 3.6 seconds and ends at
approximately 5.167 seconds. Silence or stun cancels unreleased shots while
preserving the spent cooldown. Compiled native state-machine/frame parity has
not been established for this source-based sequence.

Each shot travels at nine tiles per second with radius 0.2, hits the first
eligible ally for 150% ATK physical normal-attack damage, and grants normal
defensive SP. Swept collision shares the projectile geometry helpers. Camouflage
is respected, walls are traversable, and released shots survive source death.
Entering a Flux tile after the initial 0.04-second check delay schedules removal
0.04 seconds later; units beyond the removal position receive no hit. Flux
redirection reads the existing shared field. Native projectile VFX are still
represented by the simulator's common projectile visual.

LE-6, LE-EX-6 and its challenge variant now have atomic addition receipts,
mobile browser startup checks and complete no-deployment wave sweeps at their
compiled time limits. They remain developer-only. Source evidence is retained
in `arkpedia-flux-saxophone-animations.json` and the native ability receipt;
focused tests cover admission mutations, cast phases, interruption, first-hit
selection, defensive SP, camouflage, source death and delayed Flux interception.

## L-7 Whisperer

The passive reflector registers the native `isTwoEntriesOnly` contract. One
shared beam tracer now accepts both ordinary one-direction redirects and
incoming-direction maps. A reflector connects its two openings in either
direction; other approaches continue along their existing route. It emits no
independent beam, consumes no deployment slot and cannot be withdrawn or damaged.

Original prefab transforms and the checksum-verified `S_Music_turn` mesh show
the unrotated up/right corner. The original LE-EX-4 preview corroborates the
level's left-facing left/up opening and right-facing right/down opening. Source
hashes, coordinates and orientation evidence are retained in
`arkpedia-flux-reflector-source.json`, included in stage preflight receipts.
PRTS corroboration: https://prts.wiki/w/L-7_“回音壁” . Native compiled routing
and frame parity remain unverified. The current gold corner marker is a
functional orientation overlay; the native mesh and activation effects are not
yet shipped.

LE-EX-3 and LE-EX-4 (both variants), LE-EX-5 and LE-TR-1 now pass atomic stage
preflight, mobile startup and complete wave sweeps using compiled time limits.
Desktop and touch-landscape review also checks LE-EX-4's original initial upward
reflection and device inspector. LE-EX-5 challenge is reviewed separately below.

## Gertrude and Virtual Images

Gertrude's ten-second initial/repeating cooldown casts without nearby targets.
Silence does not cancel it; stun does. The original Skill event releases the
image at approximately 0.833 seconds, with a 1.833-second cast duration stretched
by cast slowdown. Summons reuse the parent's remaining route, survive her death,
do not count towards the wave total, and do not keep victory open. The local
same-place constraint permits one living image per rounded source tile.

Images have 5,000 HP and +1 taunt. Their silenceable immobility and Flux weakness
share the ordinary buff/status pipeline. Entering Flux applies 500 self-sourced
true damage immediately and once per second without SP recovery; leaving Flux
or silence stops it. The zero movement base remains intact, with a 0.1 minimum
after modifiers when silence removes immobility. Their original 0.5-second birth
delay and Start clip drive the local protected birth phase.

Gertrude's ordinary attacks launch two homing Arts projectiles; released shots
survive source death. The common enemy AI still allows the first ordinary attack
immediately. Subsequent attack timing uses the native animation receipt. Original
parent and image Spine bodies are supplied by the shared SD repository.

Native action/selector/buff contracts and original animation events gate both
records. Local cast sequencing, the protected birth interpretation, rounded-tile
summon exclusion and derived damage-buff lifetime have not been compared against
the compiled native state machine. Original projectile/skill effects and native
frame parity remain unfinished. PRTS corroboration: 格特鲁德女士, 格特鲁德的虚像,
and 特殊机制. The latter explicitly defines non-primary targets by victory
participation, not attack priority; Crimson Formations now use normal targeting
priority and Virtual Images retain their positive taunt.

LE-7, LE-EX-7, its challenge variant and the corresponding Leithanien camp stage
remain developer-only additions. Their browser startup and complete wave checks
are stored on each addition receipt; these are not playable-clear approvals.

## LE-EX-5 Challenge attack-speed addition

The pinned original `enemy_attribute_add` rune carries `attack_speed: 1.3`.
PRTS explicitly corroborates “攻击速度+1.3” on
https://prts.wiki/w/LE-EX-5_复合节拍 . The compiler therefore adds exactly 1.3
ASPD points, retaining fractional values. It does not reinterpret the value as
1.3 times the original ASPD or a 30-point bonus. The source's 120% HP, ATK and
DEF rules remain separate multipliers. Shared additive-stat handling applies to
both scheduled enemies and their registered summons, with unchanged base attack
time. Tests compare actual battle intervals with ordinary difficulty and cover
scoped negative fractions and invalid parameters. Native compiled rune-handler
frame parity has not been established.

Controlled desktop and touch-landscape Gertrude checks also confirm her Skill
clip, the summoned original Start body, uncounted victory behavior, native taunt,
and 500-point Flux ticks without browser errors. Browser receipts and screenshots
are retained in the working cache and stage addition validation.
