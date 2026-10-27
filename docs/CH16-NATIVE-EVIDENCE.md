# Chapter 16 native candidate evidence

The existing pinned timing index already contains the chapter 16 prefabs below.
Their original bundles are present locally and match the SHA-256 hashes in
`data/arkpedia-cn-enemy-native-source.json`; no source refresh is required to
start their controller review.

| Prefab | Existing bundle | Retained components |
|---|---|---:|
| enemy_3010_mcreep | battle/enm_pfb_28.ab | 13 |
| enemy_10203_mumag | battle/enm_pfb_31.ab | 12 |
| enemy_10211_murad | battle/enm_pfb_31.ab | 23 |
| enemy_10206_muveg | battle/enm_pfb_31.ab | 9 |
| enemy_10208_mucow | battle/enm_pfb_31.ab | 8 |
| enemy_10210_muwiz | battle/enm_pfb_31.ab | 18 |

Index keys are `dyn/battle/prefabs/enemies/<prefab>.prefab`, rather than bare
enemy IDs. The default ability extractor intentionally retains only named
components needed by previously reviewed features. Absence from that selected
output does not mean the prefab or source bundle is absent.

`data/candidates/arkpedia-ch16-native-abilities.json` retains all indexed clock
components of these six prefabs and their transitive same-bundle MonoBehaviour
references: 83 components total. Each indexed component matches the timing
index's original-data hash; referenced components carry their own hashes.
Template data remains tied to its existing source pin. This is serialized source
evidence, not runtime behavior approval or public admission.

Reproduce from the existing cache (UnityPy/aklz4 environment required):

```sh
.cache/map-env/bin/python tools/arkpedia/extract-enemy-native-abilities.py \
  --prefab enemy_3010_mcreep --prefab enemy_10203_mumag \
  --prefab enemy_10211_murad --prefab enemy_10206_muveg \
  --prefab enemy_10208_mucow --prefab enemy_10210_muwiz \
  --output data/candidates/arkpedia-ch16-native-abilities.json
```

Add `--check` to verify the candidate without writing it. The original default
extraction and `--check` still target the original evidence file. Targeted
extraction requires a separate output and refuses to overwrite that default.

The original implementation handoff covered the civilian's GetHeal, FearLoseBlood and
TileEscapeShadowManager behaviors; ChargeRift; ReverseDamage/MuradPollut;
DeadSummon; shield/StealAtk/LockDamage; and Murad's visibility/beam lifecycle.
The current behavior/admission status is in `CH16-BEHAVIORS.md`. All six base controllers
now clear candidate support under exact native contracts; stage admission remains
restricted to test-only 16-2, 16-3, 16-4 and 17-2. The crossbow's separate experimental
contract records its unresolved native direct-radius edge semantics; see
`CH16-BEHAVIORS.md`. Compile candidate support against the complete canonical enemy
candidate and verified merged evidence; do not overlay one enemy into the old
public catalogue. Implement and review behaviors before building/admitting
stages. No production pointer or public registry changes are part of this work.

The next Chapter 17 reaction evidence is retained separately in
`arkpedia-ch17-infantry-bow-source.json` and
`arkpedia-ch17-infantry-bow-native.json` under `data/candidates/`: four full
prefab graphs, two projectile graphs, four native templates and 42 indexed
components. The independent reaction review binds those files and the existing
environment evidence. The shared-engine attack-end approximation is explicit;
the original native animation duration is not claimed verified. See the 17-2
section of `CH16-BEHAVIORS.md` for integration and browser checks.

### Fortbreaker source continuation

`extract-ch16-fortbreaker.py --check` reproduces both Fortbreaker prefab graphs,
two projectile graphs, six templates and the indexed component subset from the
existing immutable native inventories. `extract-ch16-fortbreaker-animation.py
--check` separately verifies the pinned manifest/bundle bytes, external serialized
file and path-ID bindings before retaining both original skeletons from
`refs/arts/enm_art_23.ab` (SHA-256
`406ceee67c0374cf94663bc6140491f9805ae581f9bf21eb137c13978900e58a`).

Both skeletons decode `F_Skill` OnAttack at 0.8333333134651184 seconds and end
at 2.2333333492279053; `F_Attack`/`F_Combat` OnAttack is
0.7333333492279053 with a two-second clip. The skill's ON_START action assigns
MainMultiRangedAttack `times` to three or six based on commander orders. The
projectile retains its 0.6000000238418579 delay, fixed target location,
1.100000023841858 radius, source/target-invalid survival and final trace hit.
Tests bind these fields directly to retained JSON and original skeleton bytes.

`fortbreaker-clock-contract.mjs --check` now reproduces a separate exact clock
contract from those pinned graphs and original skeletons. It follows the
Attack/Combat references and the skill wrapper's same-GameObject sequence;
the wrapper's `_trigger` is its selector, not the cast ability. Both ordinary
casts have `_timeMode=0`, `_affectedBySlowDown=1`, `_maxAnimScale=1`.
F_Attack selects at release (source 1/timing 1); F_Combat retains its input
deployment (source 2/timing 0). Ordinary accepted attacks now hold movement and
release at their original OnAttack marker rather than dealing immediate damage.
The regular-engine BAT/interval playback mapping is capped at one and consumes
live native slow_down, as do the independent ordinary cooldowns.

F_Skill has `_timeMode=1`, the same slowdown eligibility, and a fixed playback
rate independent of ASPD. Its unborn rounds and clip end now advance on that
eligible cast clock; the wrapper's ten-second cooldown remains measured from
cast end on world time. Born homing shots/static impacts retain their separate
world clocks, same-life live ATK, and launch-source fallback after body reuse.
Selected target lives and damage credit cannot transfer to replacement bodies,
including replacement during an area-damage callback. Control, source removal
and battle end discard unborn work. This is a source-bound regular-engine
mapping, not compiled/native initial FSM or frame-order parity proof.

The independent review registers only the behavior actually implemented. Base
`enemy_10123_uareap` clears candidate support and is used by test-only 16-6.
The `_2` canonical record also contains AttackParam and KillBonusAura groups;
those behaviors are absent from this controller and remain explicit support
blockers. Retaining its graph and testing the common volley subset does not
admit that record. Captured native frame/render and collider-edge parity remain
held for both records.

### Slug and Manglerbeast attack/transition clock continuation

`shielded-enemy-clock-contract.mjs --check` reproduces selected clocks for both
variants of each family from the existing hash-pinned full graphs, indexed
components and original skeletons. It follows each entity's ordered `_modes`
to its separate `_attack`/`_combat` component; mode zero uses A_Attack and mode
one B_Attack. All sixteen ordinary components have TimeMode0, maxAnimScale1,
affectedBySlowDown1, input-source2/selection-timing0, and waitForAttackEvent1.
Both Slug skeletons bind OnAttack to 0.5333333611488342 seconds; both
Manglerbeast skeletons bind it to 0.800000011920929. All attack clips last two
seconds. The regular controller now releases one accepted physical attack at
that original marker, retains the input deployment, holds movement through the
clip and cancels unborn work on control, mode change or source retirement.
Live same-life ATK is read at release. Its four independent mode/weapon
cooldowns and pending clips consume eligible live slow_down; ordinary sampled
BAT/interval playback is capped at one.

Both original Trans clips last one second without OnAttack and have slowdown
eligibility, no attack-event wait and maxAnimScale-1. Slug uses TimeMode1 (fixed
playback); Manglerbeast uses TimeMode0 (sampled BAT/interval, uncapped). The
Manglerbeast's mode-zero speed buff is retired before sampling the forced
transition. These clocks now consume remaining eligible elapsed work rather
than a fixed world-time callback. Existing shield, retaliation, pool, forced
mode permanence and stun-protection rules remain separately tested. Source
removal/reuse/end also retires owned miner links and prevents generic immediate
attack fallback. Brief epoch-tracked controls are covered; Fear uses a sampled
flag because the shared engine has no between-tick Fear epoch bridge. Native
initial FSM, compiled/frame order and captured render parity remain unclaimed.

### Commander and per-action canonical level contracts

`arkpedia-ch16-reviewed-commander.json` independently binds both Commander
prefab graphs, the complete action closure and their indexed components.
The native global marked-ground-recipient aura claims exactly one active
ability per prefab; the generic Infiltrator ability line does not attach another
controller or duplicate that claim. Real source-stage tests preserve the
75-second native wait and observe six-round Fortbreaker volleys during orders,
followed by three-round volleys after source removal.

All ten test-only level builds now bind complete canonical source snapshots at
`arkpedia-data@245d7c601ce3a4a42adcfb84faa1bd1123d507bb`, generated by
`arkpedia/arkpedia@7c94fb8516030728586005b01e75620bfc9b4c3b` from the unchanged
upstream `db6f9ef8046ad17dbebe3ff1d0dd88844a5bc78c`. That normal producer retains
native `isUnharmfulAndAlwaysCountAsKilled` as a per-spawn `unharmful` field.
Source comparison tests cover each candidate's exported flags; queue/lifecycle
regressions prove those receipts do not classify ordinary/direct spawns of the
same enemy. Source-normalized generated paths retain waits, MOVE offsets and
APPEAR breaks. Excluded hidden groups must match source SIX_STAR options.
16-8 separately includes only independently reviewed group0 with an original
normal ALL enable; optional group1 remains excluded.

These repairs supersede the earlier generated-route timing assumptions without
promoting any stage. Public source inventories, the canonical enemy pin, public
enemy records and all 597 public catalogue entries remain unchanged. 16-8 is
an experimental test-only build. 16-9 retains source receipts only and is not admitted.

The Abnormal Originium Slug continuation retains both complete original graphs
(101 rows each), 44 indexed components and five transitive buff templates from
pinned `battle/enm_pfb_27.ab` / `config/buff_template_holder.ab`. Both extractors
reproduce their outputs with `--check`. Original `enm_art_23.ab` skeleton bytes
and native prefab CAB/pathID bindings reproduce separately; both `Trans` clips
are one second. `rkbomb_m0_t[shield]` retains the original MAX_HP snapshot,
InverseDamage, miner-only Physical BlockDamage and forced M1Start actions.
Independent reviewed hashes bind these bytes; extraction never grants approval.
The candidate claims exactly one wrapper and zero active general/common abilities.

The crossbow clock contract now binds both complete retained graphs to their
distinct Attack/Combat component references and original prefab-bound Spine3.8
JSON skeletons. Their original OnAttack events are0.5s for Attack and
0.53329998254776s for Combat's Skill; exact clip durations are
1.7999999523162842s and1.8667000532150269s. The producer preserves raw byte,
graph/index/inventory and skeletonData hashes and reproduces with `--check`.
Fresh hosted extraction independently reproduces the original graphs and JSON
animation source. Runtime and lifecycle tests bind these selected clocks, not
initial native FSM or exact mid-clip mode handoff/frame ordering. Listener
direct-radius/collider parity remains held, and no public admission follows.

Patrol Captain now retains its exact prefab-bound binary skeleton from frozen
`refs/arts/enm_art_6.ab`. Its original body/mode/animator graph resolves the
literal aliases `Attack_01 -> Attack` and `Attack_02 -> Combat`, both speed 1,
loop 0 and ignoreMissing 0. Both original clips have one OnAttack at 0.5 seconds
and duration 1 second. `patrol-clock-contract.mjs --check` reproduces those
references and byte/hash receipts; hosted source intake independently reproduces
the graph and original animation bytes. The runtime binds selected clocks and
output lives, while initial native FSM and precise mode-handoff/frame parity
remain unclaimed. The original interruptAbilityOnDetach 0 is retained, not used
to infer compiled dispatch behavior. No admission follows from source extraction.

The fear-projectile affliction contract independently binds the original parent
configuration, numeric event aliases (ON_BUFF_START/ON_BUFF_TRIGGER) and ordered
`feawpj_a[mcreep_fear]` template actions. The internal receiver derives only its
own Fear/Disarm receipts for marked miners and samples full HP every 0.5 seconds
before finishing the parent/children. Shared status semantics and independent
owned keys are explicit simulator mappings; native launch, event5/self-death
dispatch, initial FSM and compiled frame ordering remain unproven. The fear enemy
is still unsupported and 16-9 unadmitted. No OnAttack marker has been fabricated.

The miner now has a complete 66-object prefab graph and six-template closure,
independently reproducible from `battle/enm_pfb_28.ab` (SHA256
`91cf955ce4dd2a7b04ea6411fc748844c9b8520e421fcaabe57eca9930b09358`). The actual
external CAB/pathID binds its JSON skeleton in `refs/arts/enm_art_23.ab`; bundle
number equality is not assumed. `miner-clock-contract.mjs --check` resolves the
single mode's physical Attack, animator alias and original marker at
0.5666999816894531 seconds, with duration 1.5333000421524048 seconds. The ordinary
runtime uses a captured-life cast owner and live slowdown; fixed-tick dispatch
remains an explicit simulator mapping, not compiled frame proof.

The source-bound local 16-9 record is physical and retains only its own zero
FearLoseBlood parameter. Native talent binders and empty ability blackboards are
retained verbatim. They do not prove a default shadow duration or attachment of
absent GetHeal/TileEscapeShadowManager groups. Local passive integration and 16-9
admission remain held, and no new support follows from extraction.

`miner-listener-contract.mjs --check` additionally binds the original event-2
Fear listener, independent `mcreep_t[fear_blood]` child and shadow-work actions.
The child explicitly has firstTriggerInterval 1, interval 1 and isDerivedBuff
false; its root's 0.3-second sampling clock must not shorten that first interval.
The full-HP filter skips the damage action without finishing the child. Guardian
success executes FinishBuff on the shadow root; it does not pause/resume that
root. Existing suppression expiry belongs to the environment, independently.
Runtime receipts test root/child replacement, reentrant admission, source lives
and independent world clocks. Shared sleeping/hidden damage admission remains a
simulator mapping, not proof of compiled FixedValueDamage dispatch. These
corrections grant no 16-9/local talent support or public promotion.
Native CheckContainsBuff checks the named `fear` identity. Shared independently
keyed Fear statuses retain that identity in their status field; unrelated raw
Fear flags do not satisfy it. Both cases have direct regression checks.

### Static official Windows ability-event evidence

`data/arkpedia-global-windows-client-source.json` pins the official Global
`042.0.0` per-file manifest and only two native evidence files. The manifest is
406,719 bytes with SHA256
`7af358a88b66a04c07be860acc183645e0fb5d18f92189af6912ef0ba4259203`.
GameAssembly.dll is 141,715,432 bytes, CRC64/XZ `7563353330346910567`, SHA256
`496be6f7bfe29f4b42c2a62269199e6fed697183086be773885fbe26474d8a26`.
global-metadata.dat is 43,133,088 bytes, CRC64/XZ `3409403955085546068`, SHA256
`e3d37e4949b83c519c6dc7e2372da7675d17bd5979cebbbb8358b2581b819b11`.
The [official site](https://www.arknights.global/) supplies the launcher link
through its public download API. Static inspection of its Valid Yostar signature
and archive supplies provenance; neither launcher nor game was executed or
installed. Reproduction uses the frozen public manifest and direct file URLs.

`extract-windows-ability-events.py --check` verifies both native hashes, binds
the exact Assembly-CSharp image/token table and metadata registration, resolves
the wrapper field's actual native enum type/offset, and retains complete method
chunks through chained PE unwind records. Event5 is `ON_SPELL_END` in
`Torappu.Battle.AbilityStandard.Event`. The default
`Torappu.Battle.Abilities.BuffToOwner.OnEvent` compares the event against its
0x30 field and calls `_AddBuffs`; the fear prefab's extraCondition 0 and
onlyRunOnce 0 are retained explicitly. The handler's xLua override branch is
also retained. The code evidence includes selected coroutine/cast lifecycle
methods for further emission/order review. Raw code extraction does not itself
prove the runtime hotfix state, native frame order, Global/CN version parity,
fear launch/death sequencing, local talent selection or new enemy/stage support.
The event-free fear skeleton still receives no invented OnAttack marker.

### Projectile preprocessing and movement evidence

`extract-windows-fear-projectile.py --check` now retains the ordinary birth
chain through `RangedAttack.CreateProjectile`, `BattleController.CreateProjectile`,
the root `Projectile.Init` overload at RVA `0x678950`, and `ActionController.Init`.
The controller requests actions through virtual slot 45. The default event-zero
branch of `RangedAttack.GetProjectileActions` preprocesses its existing `m_actions`
list through slot 65 (`Ability.PreprocessActionsForProjectile`) and returns that
same list. The preprocessor passes `ability.owner` to slot 1 of the exact
`IDamageOrHealSourceNode` interface. Explicit `Projectile.RegisterActions` has a
separate boolean-gated path using `projectile.source`; ordinary controller
registration does not perform preprocessing. An independently cached damage node
for every projectile is therefore unproven. The internal damage-action port's
explicit cached-ATK argument does not establish that ownership or birth timing.

`extract-windows-fear-movement.py --check` binds the original movement component
and retains 31 complete default methods. `OnInit` and `OnTick` contain embedded
six-entry switch tables in their chained PE ranges. Each table's exact bytes,
index bias, bounds check and instruction-boundary targets are retained separately
from executable bytes; the shared strict native reader remains unchanged.
Windows `MoveType` value 1 is `TRACE_TARGET_WITH_SPEED`, selecting initialization
at `0xa7c3aa` and ticking at `0xa7ca2c`. Six original CN fields have no matching
Windows hierarchy field and remain explicit differences even though their values
are zero. `GetTraceTargetMapPosition` retains the previous target position if its
mount-point reference no longer locks. The native arrival chain sets the movement
guard, dispatches `Behaviour.Reached` and sets the projectile guard before running
arrival handlers. Only after arrival returns does the movement controller call
`EnsureLifeTime` with the trace-clearing flag. The actual delayed-completion
delegate is bound through its metadata usage and retained as a complete two-tail-
jump leaf; the selected `comeBack=false` branch reaches `Projectile.StopMe`.
The completion call loads `InvokeAsyncFixedSeconds<AdvancedMovement>`; the
independently mapped reference-shared wrapper and coroutine bodies remain
separate from unverified concrete RGCTX execution. Its float fixed-seconds waiter
clamps its frame count to at least one and yields before advancing the frame
index, including for the selected zero delay. The separately image-bound
`MathUtil.CheckDistance` uses an inclusive 3D float32 tolerance of 0.1. The internal
`fearProjectileReached` port preserves its scalar operation order and requires
all three mount-point coordinates explicitly. No caller substitutes tile
coordinates or removes the vertical axis. Remaining movement arithmetic,
mount-point mapping and scheduler lifetime/frame behavior still need review
before launch/delivery integration. These artifacts grant no runtime/frame/cross-
version parity or additional stage support.

Mount-coordinate evidence additionally binds the exact `ILocatable` interface,
the selected Windows `MUZZLE` enum value, owner slot 90 through `Unit.GetMountPoint`,
and mount-point world-to-map conversion. Actual unit/scene transform selection
remains unverified. The direct normalization and magnitude helper bodies retain
their complete PE ranges with explicit unresolved metadata identities. The
internal `fearProjectileMotionStep` maps the selected speed-10, no-inertia,
no-dynamic-speed arithmetic using supplied 3D mount coordinates and an already
scaled effective delta. It preserves float32 normalization, the 1e-5 normalization
threshold, per-component delta-then-speed multiplication and inclusive snap
comparison. Launch sampling, live/stale mount ownership, effective-delta scaling,
expiry and arrival callbacks remain separate integration work; this arithmetic
port does not register an enemy or stage.

`MountPoint.m_entity` has the same retained `ObjectPtr<Entity>` field type as the
projectile source and trace target. The internal source and mount references now
share the reviewed simulator identity mapping. An explicit mount reader is
checked both before and after coordinate extraction; entity replacement/removal
or battle end during that read cannot commit replacement coordinates. The trace
carrier keeps its last 3D destination after reference invalidation, allows one
arrival, and prevents recursive or post-end advancement. A shared projectile-
system test joins that carrier to the affliction/damage receiver and confirms
one cached impact after source removal. This proves the internal composition,
not the full native launcher, actual scene transform mapping, area targeting,
expiry/end-hit behavior or scheduler/frame parity. Stage16-9 remains unadmitted.

The projectile artifact additionally retains `OnProjectileStop`, deduplication
updates, the stop/trace virtual slots and a separately image-bound complete
signed FP greater-or-equal comparison leaf. Expiry is tested before behaviour
ticks. `StopMe` sets its stopped guard before dispatching stop handling and
destruction. The selected configuration forces a final saved-target hit but
does not force an area-arrival event; elimination suppresses that final hit.
The internal `fearProjectileHitLedger` preserves the native order: per-identity
reservation before the normal 128-hit cap, forced trace hits bypassing only that
cap, and count increment after the hit callback. A cap-rejected attempt remains
reserved, and a normal hit cannot repeat during final trace handling. Tests cover
recursive stop/hit calls, source retirement with cached damage, recycled trace
bodies, elimination and reentrant battle end. This is a selected hit/stop port;
the FP lifetime clock, deferred stop scheduling, area-selection caller and full
launcher integration remain held. No additional enemy or stage support follows.

The selected lifetime clock now has a source-bound Q32.32 arithmetic port.
Retained `FP` multiply/add/integer-conversion leaves, float constants and
`FP.AsFloat` establish signed64 wrapping, 32 fractional bits and integer-to-
float32 rounding before scale conversion. Ordinary `_InitInline` resets current
time to zero; movement slot 14 supplies the lifetime/behaviour delta scale.
`fearProjectileLifetime` takes explicit raw input delta and movement scale,
accumulates with that arithmetic and expires at raw `42949672960` before a
movement result is returned. Its expiry guard latches before the stop callback.
Tests compose the clock with motion and terminal damage, including a one-raw-unit
boundary that float seconds would round early, pause/slowdown, signed64 wrapping,
float halfway rounding, recursive dispatch and cancellation. The engine-to-native
raw input-delta mapping, deferred stop scheduler, area selection and full launch
registration remain unverified. This port grants no stage admission or frame
parity.

### Arrival overlap and dispatch

`extract-windows-fear-area.py --check` retains 36 complete methods covering the
range/query/filter pipeline, enemy physics and map conversion, together with
the exact layer-mask tail-jump leaf, the `List<Entity>.Sort` call
specification and the original circle/collider/transform graph. Authored local
radius is 1 with zero offset and unit root scale. Runtime range scaling, target
body geometry and actual overlap order remain separate from those authored
values. Original `CircleRange._useBlackboardRangeId=0`, top-level
`HitBehaviour._exceptFlyCharacter=0` and nested `TargetOptions.ignoreMotionMode=0`
have explicit unmatched Windows fields; their zero values do not grant parity.

The internal `fearProjectileAreaDelivery` consumes an explicit ordered collider
query and explicit validity/target-option/UID readers. It deduplicates accepted
UIDs, stops at 128 before deterministic sorting, notifies a valid source of the
positive selected count, then dispatches captured recipient lives. It does not
substitute point-distance geometry or infer native UID ordering from labels.
Tests join this dispatch to the hit ledger and affliction/damage receiver, with
duplicate colliders, source retirement, cap/order edges, recipient replacement,
recursive calls and battle-end cancellation. This does not supply the actual
physics query, scene/layer mappings, dynamic range scale, concrete native sort
context or full launcher. Enemy/stage support and public catalogue gates remain
unchanged.

The actual generic query resolves `Component.GetComponent<Entity>` on each
collider, rather than searching its parent. The checksummed original miner root
has the script-bound `Enemy` (whose native lineage includes `Entity`), a
`Rigidbody2D` and an enabled radius-0.1 trigger. The child collision holder has
only a Transform and CapsuleCollider2D; its attachment to the root rigidbody
does not make it a same-object Entity. Retained `_InitPhysics` reads the root
circle's radius, converts it to FP and stores the field returned by the default
collider-radius getter. `Map.WorldToMapPositionV3` calls the anchor's inverse
transform. Tests pin the script identity, component ownership, generic method
specifications and those native call/storage sites. Runtime scene transforms,
layer eligibility and Unity overlap boundary tolerance remain unverified; the
shared engine's assumed collider radii are not substituted as native proof.

### Selected flight composition

`fearProjectileFlight` now joins the raw Q32.32 lifetime, 3D trace motion,
arrival query and hit ledger behind explicit native-input callers. Expiry runs
before motion and can force only the saved trace recipient. Arrival reserves
its reached guard, performs the area callbacks, then resets current time with
`EnsureLifeTime(0)` and clears the trace reference before requesting deferred
completion. The retained `FP.op_Subtraction`/`FastSub` leaf establishes that
reset as signed64 `lifeTime - remainingTime`, not a new ten-second lifetime.
Completion and the next expiry check may race; either path can stop the flight
only once. The completion caller must defer its callback and provide cancellation.

Tests cover the full supplied-input flight through arrival and real affliction/
damage after source retirement, expiry before movement, lost trace identity,
elimination, recursive callbacks, battle-end cancellation and competing stop
paths. The selected composition owns its internal observers and cancels its
pending completion on release; externally supplied source/mount references
remain their caller's responsibility. Native raw delta production, actual
coordinate transforms, physics query/target filters, concrete scheduler timing,
cast launch and initial FSM integration remain required before stage16-9
admission. No new stage, enemy support receipt or public catalogue entry follows.

### Selected arrival eligibility

`fearProjectileTargetVerifier` ports the selected arrival option branches after
the actual collider/layer/validity query. It requires native motion/category and
side readers, a captured source side, target-free readers and a source-motion
snapshot reader. Ground/category masks run first. A nonzero source side enables
the distinct opposing-target and same-side target-free checks; source retirement
does not erase that captured side. The motion-dependent check forwards native
flags44/combo2 to the supplied slot84 semantics. The retained trampoline and
metadata distinguish Entity/Enemy's implementation from Character's override.
The selected zero profession mask passes the native helper's explicit accept-zero
branch; disabled unit-type, purpose and extra abnormal filters are not enabled.

Tests cover opposing and same-side target-free states, zero source side, motion/
category rejection, missing native values, replacement and battle end during a
reader, recursion and area dispatch after source retirement. Complete native
basic/advanced filters, source motion lookup, profession helper and Entity and
Character motion-target-free bodies are retained. Actual native state readers,
source snapshot construction, hotfix/runtime dispatch, layer query and scene
mapping remain integration obligations. The internal verifier does not convert
generic simulator hidden/untargetable flags into an asserted native receipt.

The source-motion input now has a separate internal `fearProjectileSourceMotion`
composition. Native initialization allocates the metadata-bound `SourceSnapshot`
and stores changeable motion before retaining it beside a `PtrObjRef<Entity>`.
Lookup calls `ValidAndAliveOrDying` on that reference: the successful path uses
current changeable motion; the unsuccessful path uses captured motion, or mode2
when there is no snapshot. This predicate differs from the damage action's
`ObjectPtr<Entity>` UID validity rule. Canonical generic constructor/Get/validity
bodies and the actual concrete Entity usage sites are retained, with concrete
generic context still unverified. Tests distinguish local alive flags from the
explicit native predicate, exercise fallback and missing-source behavior, reject
replacement/removal during a read, and feed live/captured motion into arrival
eligibility. Native PtrObjRef registry, alive-or-dying and motion state readers
remain explicit integration inputs rather than guessed local flag mappings.

### Arrival side and layer masks

The retained `SideTypes` initializer binds same-side masks `[1,2,4]` and
opposite-side masks `[2,5,2]`: an Enemy source's opposite mask includes both
Allies and Neutrals. `ConvertSideType` with source side0 returns the literal
requested side, while the nonzero opposite lookup compares each single bit for
equality. A separately image-bound complete `IndexEqualsToBinaryMask` leaf proves
that combined sides do not select the first contained side. `Layers` resolves
the original ALLY/ENEMY/NEUTRAL names through Unity `LayerMask.NameToLayer` and
builds signed32 masks with bit shifts; prefab layer numbers alone do not prove
the runtime name-to-index table.

The selected `fearProjectileArrivalLayerMask` ports targetSide2 with explicit
runtime layer indices, including Enemy-to-Allies-and-Neutrals, source side0,
unrecognized combined sides and signed bit31. A composed query test retains
neutral recipients while excluding the enemy layer. Original layer names,
complete layer/side initializer bodies, field offsets, constant writes and the
Unity API binding are retained. Scene layer indices, collider world geometry
and physics ordering remain required inputs; no stage support follows.

### Frozen original Unity settings

`windows-settings-source.mjs --fetch` obtains only the 985,100-byte
`Arknights_Data/globalgamemanagers` from the same frozen official042.0.0 manifest.
Its publisher CRC64/XZ and retained SHA256 are checked independently, without
changing the two-file native-code intake or executing the client.
`extract-windows-physics-settings.py --check` reproduces the complete TagManager
and Physics2DSettings trees from Unity2021.3.39f1. The original named indices are
ALLY10, ENEMY9 and NEUTRAL28, yielding mask268436480 for the selected Enemy
opposite-side query. The original miner root's layer28 and collision holder's
layer19 match NEUTRAL and ENEMY_COLLIDER in this static Windows table.

The Physics2D source retains trigger-query and start-in-collider defaults,
automatic transform synchronization, the full layer collision matrix and the
other serialized settings. These are original defaults, not proof that battle
code/hotfixes never override them or that CN uses the same settings. Tests pin
the source chain, named indices, query defaults, selected mask and matching
prefab layer roles while keeping runtime/cross-version/frame flags false.
Hosted native-source validation fetches and reproduces this bounded file.

### Bounded attack-event wait

`fearProjectileAttackWait` ports the selected wait-for-attack-event branch with
`_interuptIfTargetDead=0`. It receives cached native duration, an explicit
deltaPlayTime reader and coroutine resumes. Initial resume registers Entity.Event19 and
yields at index0; later resumes finish on a received event or increment/check
the bounded count. An event during registration still cannot bypass that first
yield. Handler removal and receipt clearing precede the readiness callback.
The selected `_interruptAbilityOnDetach=1` is reflected by cancellation when its
owner life is removed, alongside an explicit cast-active reader and battle-end
cleanup. Target death does not add an interruption condition.

The native delegate usage sites distinguish `_CheckNotReceiveEvent` from the
target-alive predicate and bind `_OnReceiveEvent` for both registration and
removal. Tests cover event-free timeout, event resumption, initial yield,
recursive calls, owner reuse/removal, cast interruption and cancellation during
registration. A supplied-input composition launches one flight from timeout
readiness and retains its affliction/damage after subsequent source removal.
The wait count derives from cached ability duration and native deltaPlayTime;
the event-free clip's visual duration is not substituted for that clock. Actual
cached-duration/input sampling, coroutine scheduling, the full cast/launch sequence and
event5 self-death ordering remain required integration evidence. No synthetic
OnAttack marker, enemy support receipt or stage admission is added.

The timeout conversion now has an internal `fearProjectileWaitFrameCount` port.
It consumes signed Q32.32 cached duration and the actual float deltaPlayTime,
performs float32-to-FP conversion, the native unsigned long-division loop with
its extra rounding bit and reserved overflow values, then FP ties-to-even
rounding, signed low32 conversion and the minimum-one-frame clamp. Division by
zero preserves the native raw-minus-one result before that clamp. Tests cover
quarter/30fps inputs, exact halfway counts, one-raw-unit division-rounding edges,
overflow, invalid inputs and a computed-count event-free wait. Complete FP.Round,
FP static initialization and BattleController.get_deltaPlayTime are retained
alongside the earlier division/float conversion/MathUtil.RoundToInt bodies.
Actual cached-duration production and battle coroutine scheduling remain caller
integration obligations; no visual-clip duration is substituted for attack time.

The wait controller now calls that conversion internally after attack-event
registration on its first resume. Cached duration is captured as a raw value;
deltaPlayTime is read exactly once at wait initialization, and later resumes
reuse the converted limit. The native cast-start virtual slot101 resolves to
AbstractAnimatedAbility.GetDuration and stores `m_cachedDuration` at0x118;
the FP waiter's resumption branch bypasses its timing initialization. Tests
change timing between construction and initialization, change it again while
waiting, deliver an event during timing sampling, and cancel or reject malformed
timing after registration without leaking an event handler. These inputs still
come from explicit native-state callers; engine sampling and coroutine cadence
are not inferred from a generic simulation step.

### Single-spell continuation

`fearProjectileSpell` joins successful spell-start/launch, the casting-state
check, spell-count1 and event5 dispatch in the native default single-spell
order. The retained `CheckAnotherSpell` default returns false; runtime hotfix
behavior is not certified. A rejected spell start or lost casting state does
not emit spell end. Event5 precedes owner/action checks for post-delay and can
remove the owner itself; no removed or recycled owner is passed to post-delay.
The helper does not own or clear independently born projectiles.

Tests compose the bounded wait, actual internal flight, event5 source removal,
affliction and cached damage. They also cover rejected launch/casting/post-delay
gates, recursive spell calls and owner reuse during the casting-state reader.
Native `_DoCast` call/branch sites and RangedAttack virtual slots73/78/89 bind
the ordering. This is a selected continuation with explicit launch, event5 and
post-delay callers. Initial target selection, actual mode-switch/self-death
receivers, full coroutine completion/interrupt handling, native mount/query
inputs and stage support receipts remain integration obligations.

### Self-death template action conditions

`extract-windows-fear-self-death.py --check` retains the original
`fearpj_m0_t[switch_to_die]` template and 84 complete default node/runner/entity/mode/FSM
methods. The chain checks unset LEVITATE, FROZEN, STUNNED and SLEEPING on
BUFF_OWNER, switches TARGET to mode1 with FSM restart, creates the immunity
buff on BUFF_OWNER, then runs AlwaysNext and InstantKill on TARGET.

The native runner exits when a default previous-success execution condition
fails. Consequently a failed early control check or mode-switch action stops
before later effects. AlwaysNext has condition0 and returns true; its position
immediately after CreateBuff permits InstantKill when that action returns false.
An action's return value is not automatically the same as a buff admission
receipt. The immunity node's exact original data remains retained, including
infinite lifetime and STUNNED/FROZEN/LEVITATE plus SLEEPING immunity.

`fearProjectileSelfDeath` ports this selected action order with explicit native
state/effect callers and independent captured BUFF_OWNER/TARGET lives. Tests
cover each early control rejection, mode-switch failure, CreateBuff false,
context separation, recursion, owner reuse and battle end. InstantKill receives
all original option switches, including killSource=false and noSource=false;
the helper does not invent a kill-credit source. Buff activation/context binding,
actual mode/FSM, immunity creation, native kill reason/credit/reborn behavior and
full event5 integration remain required before an enemy support receipt or
stage admission is granted.

The selected InstantKill branch is now bound through `Entity.Suicide` and
`SetHpInternal`, including metadata parameter names and the actual slot108
dispatch. It checks alive, sets `m_isSuicide`, and calls forced zero HP with the
selected noSource=false and skipReborn=false switches. No separate killer
pointer is supplied by this action branch. `InstantKill.Execute` then returns
get_alive after Suicide, so an effective death may return false; that Boolean
must not be interpreted as a kill-success receipt.

`fearProjectileSuicide` ports this selected sequence behind explicit native
alive/mark/HP callers, with tests for dead targets, post-action return values,
owner replacement, recursion and battle end. Native death/credit/reborn event
processing remains in the HP caller; no generic b.kill credit is substituted.
The area-query slot38 receipt is also corrected and explicitly bound to
get_alive rather than labeled as generic selectability. Target-free and other
eligibility checks remain the separately retained TargetOptions branches.

### Buff activation target binding

`extract-windows-fear-context.py --check` retains nine complete Buff/ChangeGuard
methods and the complete `Nodes.GetActionTarget` method. The latter has an
embedded eleven-entry image-relative table. All code bytes, table bytes,
dispatch bounds and instruction-aligned destinations are classified and
checked; the shared strict decoder is unchanged.

Native Buff.OnStart invokes event0 with target-to-owner enabled. `_RunActions`
sets the buff/source context and, on that branch, writes Buff.owner into target.
The actual target-type enum and resolver bind TARGET0 to the context target and
BUFF_OWNER3 to Buff.owner. For this activation both resolve to the owner, even
if the incoming context had another target. The original started-field guard
and subsequent started write are retained separately from local one-shot safety.

`fearProjectileSelfDeathActivation` supplies that selected binding to the action
handler. Tests prevent incoming TARGET/BUFF_OWNER values or a reused owner body
from redirecting the self-death actions. General context routing remains exposed
only by the lower-level handler. Actual BuffToOwner/AddBuff admission, effect
application, native context stack timing, mode/FSM and HP death processing still
require integration before enemy or stage support is granted.

### Mode1 and FSM restart

The self-death evidence now binds the original Enemy mode array in order,
mode1's absent attack, EmptyAnimatedAbility combat and SimpleUnitAnimatorHooker
mapping Die to Die_2. It retains all three Unit.SwitchMode overloads, mode
activation/inactivation, Unit/Enemy OnSwitchMode and the FSM running/start/stop
paths, with metadata argument names and exact component/script hashes.

The native mode core inactivates the old mode, writes `m_currentMode`, activates
the new mode and dispatches OnSwitchMode. For restartFSM=true, Unit.OnSwitchMode
only restarts an already-running FSM: it captures currentStateId before Stop and
passes that saved ID to Start. It does not replace it with a default or start a
stopped FSM. The reviewed Stop tail-jump leaf and its full callee remain separate
from the unchanged strict generic reader.

`fearProjectileModeFsmRestart` ports that selected restart with explicit native
state-machine callers. Tests preserve the old state when Stop mutates it, leave
stopped FSMs alone, reject reuse/battle end during Stop, guard recursion and
compose restart before immunity/suicide. Native mode activation, ability detach/
attach, pose preservation, animation hook execution and live FSM state/cadence
remain integration inputs. Initial FSM admission and full enemy/stage support
are still unproven.

### Selected mode lifecycle handoff

`fearProjectileModeSwitch` now composes the selected non-initial, non-forced
mode switch: reject an equal mode, capture native Vector2 facing/body direction,
read the old mode after pose reads, detach its initialized `m_abilities` entries
in array order, invoke OnInactivate and disable its object. It samples lastMode
again after inactivation, writes the new current mode, enables it, conditionally
attaches its initialized abilities, invokes OnActivate and OnSwitchMode, then
restores both copied pose values. Duplicate entries and live array length are
preserved; this is not a deduplicated attack/combat list.

The attachment predicate is specifically Entity.get_startIniting at 0x3a2f650,
called at 0x84cf8f. Metadata and its default field read at offset0x89 disprove
interpreting that call as alive/aliveOrDying. A false predicate skips the static
ability attach loop but still invokes mode activation and switch notification.
The artifact now also retains complete Ability.Attach/Detach, UnitMode
OnActivate/OnInactivate and Entity pose methods, plus their metadata slot and
field bindings. Dynamic ability/talent effects inside the native mode callbacks
remain explicit callers, rather than being silently discarded.

Lifecycle tests cover removal/reuse/battle end between effects, reentry,
same-mode rejection, callback changes to currentMode, duplicate/appended ability
entries and pose mutation during notification. A composed self-death test uses
the mode handoff, captured-state FSM restart and suicide handlers together,
requiring mode effects and restart before immunity and zero HP. The focused
native-source/fear/family/miner suite passes 355 tests locally and the 33-method
source producer reproduces with --check. The prior hosted continuation
40512603998 and full Linux/Windows run40505955414 both completed successfully.

Native initialized ability-array construction, concrete OnActivate/OnInactivate
and Enemy.OnSwitchMode talent implementations, live FSM/coroutine scheduling,
animation hooks and stage coordinate/query readers still require integration.
These internal components grant no enemy/stage support receipt; all existing
test-only and catalogue gates remain unchanged.

### Mode ability initialization and composed self-death flight

The artifact retains UnitMode.InitOnce, OnInit and _InitAbilities, bringing its
ordinary method count to36. InitOnce sets the original inited flag before
talent/ability initialization; these methods are distinct from OnInit's ability
data setup. _InitAbilities collects valid general abilities, then combat, then
attack into m_abilities. Its exact encoded generic method loads bind
List<Ability>.Add and RemoveDuplicationsInplace<Ability>. The concrete latter
has no direct native mapping: the independently mapped Object specialization
at0x3f62c90 supplies retained reference-shared code; concrete RGCTX execution and
the Equals dispatch helper's metadata identity remain unverified.

`fearProjectileCollectModeAbilities` ports that selected collection order with
explicit native validity/equality predicates. Duplicate removal swaps the last
element into the duplicate index, removes the last and advances the inner
index. It does not preserve stable order or recheck the swapped index: three
equal entries can leave two. Tests preserve that literal behavior and reject
non-Boolean predicates. This supersedes treating the array as an arbitrary
attack/combat pair or a stable Set; the handoff still iterates whatever entries
actually remain in the initialized array.

The original fear mode0 initializes [general ability, ranged ability], with its
shared combat/attack reference included once; mode1 initializes [empty combat].
The composed wait/spell/flight test now supplies these original initialized
arrays to the mode transition, detaches both mode0 entries, restarts the saved
FSM state and executes immunity/suicide before advancing the independent born
projectile. Its impact still applies fear and cached damage after the owner is
removed. This exposed and fixed a missing retirement check after InstantKill:
the action chain now observes cancellation before validating the returned
Boolean, so the suicide adapter's null retirement result cannot throw.

The focused native/fear/family/miner suite passes359 tests and the producer
reproduces with --check. Existing checkpoint55cb5385's continuation40514427997
has passed native-source and both focused OS jobs; its17-12 browser job and
full40514426781 remain active at this checkpoint. Neither live run is replaced.
Native concrete equality, initialized ability data/talents, live FSM scheduling,
animation and stage geometry/query integration remain open; this checkpoint
does not admit the fear enemy or16-9.

### Mode talent and dynamic-ability callbacks

The43-method artifact additionally retains UnitMode._InitTalents and
_SetAbilityDataAndAttachIfNeed, together with BasicTalent.get_isValid,
get_isAttached, Attach, Detach and SetParentMode. The exact slot6 metadata
binding identifies the attachment predicate used by both mode callbacks;
it is separate from validity and from Unity object validity.

`fearProjectileModeEffects` composes selected UnitMode.OnActivate/OnInactivate
effects with explicit native readers and effect callers. Non-initial activation
attaches valid, currently detached talents; inactivation detaches valid,
currently attached talents. Initial activation skips the talent pass. Both
paths then process the dynamic ability keys in their current collection order,
without applying the static ability loop's Unity-validity filter. Null dynamic
entries fail. The dynamic list remains distinct from the initialized static
m_abilities list and its startIniting attachment gate.

The native activation path reloads a talent array entry after validity and
attachment predicates, whereas inactivation retains its captured talent object.
The adapter preserves that difference and rereads collection lengths after
effects. Tests cover predicate replacement of entries, collection growth,
reentry, retirement/reuse and battle end. A composed mode handoff verifies
static detachment, talent detachment, dynamic detachment, old object disable,
currentMode assignment, new object enable, talent/dynamic attachment and mode
notification/pose restoration in order. A false startIniting skips new static
attachment without suppressing new talent/dynamic effects.

The focused source/fear/family/miner suite passes374 tests and all43 ordinary
methods reproduce with --check. Continuation40514427997 at55cb5385 has now
completed successfully; full40514426781 is still running and is not replaced.
The new callbacks still require concrete initialized native talent/dynamic data
and BasicTalent effect implementations. Enemy.OnSwitchMode's separate enemy
skill list, live FSM scheduling, animation and stage query integration remain
open; no source/support/receipt gate is relaxed.

### Enemy mode notification and skill ownership

The49-method artifact additionally retains EnemySkill.get_parentMode,
get_isRoot, Attach and Detach, Unit.OnAttackRangeChanged and
BuffContainer.OnUnitSwitchMode. Metadata slot127 resolves the Unit virtual
notification to OnAttackRangeChanged. The original Enemy.m_skills field at
offset0x498 and EnemySkill.parentMode atoffset0x78 are retained separately
from UnitMode's BasicTalent/static/dynamic ability collections.

`fearProjectileModeNotification` composes the selected restartFSM=true
Enemy.OnSwitchMode dispatch. Unit base work comes first: restart the existing
FSM through the captured-state handler, notify attack-range change, then notify
the buff container. It subsequently visits the current enemy skill list in
order. Root skills skip parent reads and effects. A nonroot skill belonging to
nextMode is attached; otherwise its parent is read again and a match against
lastMode detaches it. Skills belonging to neither mode are unchanged. A new-mode
match takes precedence; attachment-state and Unity-validity filters are not
invented for this separate skill loop.

Tests cover notification order, stopped-FSM continuation, root exclusion,
new/old precedence, a changed parent getter, list replacement during the buff
notification, appended skills, malformed predicates, null entries, recursion,
reuse and battle end at each effect boundary. The composed bounded wait,
original initialized mode arrays, self-death and independent flight test now
also uses this notification handler with synthetic root/old/new skills. It
verifies range/buff notifications and skill detach/attach before suicide, while
the born projectile still applies fear and damage after owner retirement.
These synthetic skill records do not certify the original fear enemy's complete
skill data or effects.

The focused native/fear/family/miner suite passes406 tests and the49-method
source producer reproduces with --check. Continuation40516147908 at6de1933a
remains queued and full40514426781 is in progress, so neither is replaced.
Concrete attack-range/buff notification effects, EnemySkill attachment effects,
ability data setup, live FSM/coroutine scheduling and stage geometry/query
integration remain explicit inputs. All enemy/stage support and test-only
catalogue gates remain unchanged.

### Buff mode-change probe, dispatch and context

The56-method artifact additionally retains Buff.OnUnitSwitchMode,
_IsActionValid, get_isFinishedOrDisabled, get_isFinished and get_isEnabled,
plus BuffContainer._CheckBuffsActionValid and _CheckFinishedBuffs. The selected
Buff.Event.ON_UNIT_SWITCH_MODE constant is75: its exact signed Int32 default
uses reviewed compressed bytes8096. This bounded two-byte case is retained
without weakening the shared one-byte enum decoder.

`fearProjectileBuffModeChange` ports the container's eligibility probe and
dispatch order using explicit native iterator callers. The probe skips null,
finished/disabled and action-ineligible buffs, stops at the first eligible buff
and disposes its cursor. Only a successful probe opens the separate dispatch
iterator. That pass checks current enabled/finished state and action eligibility
again before invoking event75 actions. Each run uses setTargetToOwner=false,
matching Buff._RunActions's R9=false call; this must not reuse OnStart's
owner-target binding. The dispatch cursor closes before _CheckFinishedBuffs.
An unsuccessful probe skips both dispatch and finished-buff cleanup. Exceptions
still dispose their cursor and skip subsequent cleanup; local owner retirement
also prevents callbacks against a replacement life.

Tests cover both iteration passes, early probe exit, repeated action checks,
different contents visible to the second iterator, exceptions, recursive calls,
reuse/battle end, retirement during cursor acquisition and action execution.
A composed enemy notification test retires the owner inside a mode-change buff
action, requires cursor disposal and prohibits later enemy skill effects.
The focused native/fear/family/miner suite passes427 tests; the56-method source
producer reproduces with --check. Existing continuation40516147908 and
full40514426781 remain active and are not replaced at this checkpoint.

Native double-buffer visibility/ordering, exact action/context effect callers
and finished-buff removal remain explicit inputs. These source and composition
tests do not certify concrete engine buff-container execution, the fear enemy
controller or16-9 stage support. No support/receipt/catalogue gate changes.

### Forward buff iteration and nested snapshot visibility

The source artifact now retains five independently mapped Object canonical
generic bodies: DoubleBufferedList.GetEnumerator, _ForwardEnumeratorOnDispose
and ForwardEnumerator.Dispose, MoveNext and get_Current. The closed call-site
specification38599 resolves DoubleBufferedList<ObjectPtr<Buff>>. Its nested
argument and ObjectPtr<Buff>.Lock specification253183 are bound separately from
the canonical methods; concrete RGCTX execution and native pool reuse remain
unverified. Generic definition field metadata is retained without treating its
zero offsets as verified closed-instance offsets. The strict general generic
decoder remains unchanged; the nested argument decoding is explicitly bounded
to this reviewed ObjectPtr<Buff> shape.

The default GetEnumerator code increments a UInt16 nesting counter before
snapshot acquisition. It clears/copies the internal list only when the previous
counter was zero. Nested forward enumerators use that same cached buffer.
Dispose retires a cursor once and decrements the shared counter before returning
it to the native pool. MoveNext increments its Int32 cursor before comparing
against the buffer count; get_Current returns the selected T value.

`fearProjectileBuffIteration` composes these selected counter/snapshot rules
with the mode-change dispatcher. Already ordered native entries, ObjectPtr value
copying and UID locking remain explicit readers. Copies are required both when
acquiring the snapshot and when returning current, so mutable wrapper records
cannot change a saved pointer value or mutate the cached buffer during Lock.
Local life/reentry guards reject stale cursor operations and close all cursors
on owner retirement or battle end; they do not claim native pool alias parity.

Tests prove shared outer/nested views, refresh after the last cursor closes,
independent cursor positions, copied pointer values, repeated disposal, cursor
range errors, failure rollback, acquisition/current recursion and owner-life
cancellation. A composed mode-change test changes the live list during an
action, nests another notification and requires both traversals to see the old
snapshot; a subsequent outer notification sees the new list. The focused
native/fear/family/miner suite passes438 tests and the producer reproduces the
56 ordinary plus5 canonical generic methods with --check.

Continuation40516147908 at6de1933a completed successfully. Full40514426781 is
still running and is not replaced. Sorted insertion/removal of native buff
entries, concrete ObjectPtr locking, finished-buff effects, full controller
scheduling and stage geometry/query integration remain open. This checkpoint
does not create enemy or stage support receipts or change catalogue gates.

### Sorted buff list mutation and iterator composition

The61-method artifact adds SortedDoubleBufferedBuffList.Add,
DoubleBufferedBuffList.Remove/ClearInvalidElementsIfNotLoop and the Buff UID
and event-priority getters. Buff.instanceUid atoffset0x208 is UInt32;
onEventPriority atoffset0x24c is OnEventPriority, a signed Int32-backed enum.
The Object canonical get_isInLoop at0x4d980a0 is retained independently from
the concrete caller's0x4d97fd0 body and its exact encoded specification229767.
The latter has no direct generic mapping, so concrete context parity remains
false; the two compiled bodies are not treated as interchangeable evidence.

`fearProjectileBuffList` now composes selected native list mutation with the
shared forward snapshot iterator and two-pass mode-change dispatcher. Valid
entries insert by descending numeric event priority, scanning backward and
inserting after an existing equal priority. This preserves insertion order for
equal priorities. Invalid entries append through the base-list path, and invalid
existing entries do not supply comparison priorities. The algorithm compares
current priorities during insertion; it does not sort the whole list after an
existing buff priority changes.

Removal scans backward and compares current instance UIDs rather than JS object
identity, removing only the first valid match in that reverse scan. Invalid
pointer cleanup returns without scanning while a cursor is open, and otherwise
removes invalid entries backward. Mutating the internal list leaves an existing
outer snapshot unchanged; a later outer iterator sees the updated sorted list.
Native pointer copying/validity/Lock and field getters remain explicit callers.
Local reentry/life guards prevent mutations against replacement owner lives;
add/cleanup keep their native void completion shape, while Remove returns its
native Boolean result.

Tests cover priority ties, live priority changes, duplicate UIDs, maximum UInt32
UIDs, invalid entries, loop-gated cleanup, snapshot retention, reused pointer
values, malformed field readers, callback retirement and recursive mutation.
A composed sorted-list/iterator/mode-change test inserts and removes entries
during an action and nests another dispatch; it requires both traversals to
retain the old snapshot and the next dispatch to observe current sorted entries.
The focused native/fear/family/miner suite passes453 tests; the producer
reproduces with --check. Continuation40519284428 at64ef2cb7 completed
successfully, while full40514426781 remains active and is not replaced.

This closes the explicit ordered-entry input for the selected internal list
adapter. Actual native pointer registration, finished-buff removal/effects,
ability data setup, complete fear/controller scheduling and stage geometry
integration remain open. No enemy/stage support or catalogue gate is changed.

### Concrete selected buff pointer identity

The artifact now retains independently mapped ObjectPtr<Object> constructor,
Lock and get_isValid bodies, with separate ObjectPtr<Buff> specifications and
obj/cachedUid field metadata. The concrete Buff specifications have no direct
native mapping and concrete context execution remains unverified. The ordinary
method count becomes62 with ObjectExtensions.IsDestroyedOrNull, resolved in
its own Torappu.Common.dll image. Buff's metadata lineage is Buff->System.Object;
it cannot enter the helper's UnityEngine.Object destroyed-object branch.

`fearProjectileBuffPointers` supplies selected ObjectPtr<Buff> capture, copy,
validity and Lock to the sorted list and snapshot iterator. Capture rejects null
and an initial UID0, storing a null/zero pointer. Otherwise the native constructor
stores the object and samples UID again for cachedUid; the second getter result
must not be replaced by the first. Both stored fields are copied by value.
Validity requires a nonnull object and equality between its current UInt32 UID
and cachedUid, without considering finished/enabled state or the owner's life.
Lock returns that same object only on a valid match. A UID change invalidates
old pointer values instead of redirecting them to a pooled replacement.

Tests cover null/zero capture, maximum UInt32 UID, both constructor samples,
copied wrapper values, malformed UIDs, UID reuse and finished/disabled/owner-
retired objects. The constructor's second UID read can itself return0 after a
nonzero first read; tests preserve that distinction from initial UID0 rejection.
A composed concrete-pointer/sorted-list/iterator/mode-change test retains
finished and disabled UID-valid objects in the list while the dispatcher filters
them by their separate state, then removes a genuinely invalidated pointer.
The focused native/fear/family/miner suite passes459 tests and the source
producer reproduces with --check. Existing continuation40521019928 and
full40514426781 remain active and are not replaced.

Native UID allocation/pool recycling and actual buff state/effect callers still
require integration. Finished-buff removal/override-group effects and complete
fear/controller/stage scheduling remain open; no support or catalogue gate is
relaxed by these pointer identity tests.

### Reverse iteration and finished-buff cleanup ordering

The artifact retains seven Object canonical reverse-iterator methods, including
GetInversedEnumerator, disposal, current, construction and reset. Backward
MoveNext is a reviewed complete14-byte six-instruction leaf that decrements its
Int32 cursor and tests the sign bit, with no stack changes, calls or branches.
It is retained locally without weakening the generic PE/unwind reader. The
ordinary count becomes65 with _FinishAndRemoveBuff, get_overrideKey and
OverrideGroup.Remove. Native concrete generic context/pool parity remains false.

`fearProjectileBuffIteration` and the sorted list expose reverse iterators using
the same UInt16 counter and cached buffer as forward cursors. Reverse cursors
start at the snapshot count and decrement before reading the last entry. Forward
and reverse cursors retain independent positions while sharing snapshot
visibility; the first later outer traversal refreshes after all cursors close.

`fearProjectileFinishedBuffs` ports the selected _CheckFinishedBuffs pass.
It walks backward, records null pointer entries, and calls finish/remove only
for a currently finished nonnull buff. It reads overrideKey after that effect,
checks null/empty, then reads it again for the override-group lookup. A successful
lookup requires a nonnull group and runs its remove effect. The iterator closes
before invalid-element cleanup, which runs only if the traversal saw null.
Exceptions/cancellation still dispose the cursor and skip later cleanup/effects.
Native finish/pool, dictionary lookup and group mutation remain explicit callers.

Tests cover reverse/forward shared views, reverse order, both override-key
samples, group misses/null results, finish exceptions, owner reuse/battle end,
recursion and disposal. A pointer/list/cleanup composition removes finished
entries while an outer forward cursor retains its old view and correctly defers
invalid-entry pruning until the outer cursor closes. A dispatch-to-cleanup test
adds a buff during an event, excludes it from that active traversal, closes the
dispatch cursor, opens a fresh reverse cleanup view, then removes the newly
finished buffs in reverse order. These use synthetic buff state/effect callers,
not a claim that native pool/override-group execution is integrated.

The focused native/fear/family/miner suite passes486 tests and the source
producer reproduces with --check. Full40514426781 at55cb5385 has completed
successfully. Continuation40521019928 atc40fdc78 has passed native-source,
Windows focused and all stage-browser jobs; its Ubuntu focused job remains
active and is not replaced at this checkpoint.

UID allocation/pool recycling, full finish/override effects, original ability
data, live controller/FSM scheduling and stage geometry integration remain open.
No enemy/stage support, source receipts or catalogue gates are changed.

### Finish/remove effects and deferred recycle request

The70-method artifact additionally retains BuffContainer._FinishBuff,
Buff.MarkFinish/OnFinish, BattleController.RecycleBuffNextFrame and
OverrideGroup._DoUpdateInternal. Metadata argument names bind the selected
_FinishBuff call to updateOverrideMap=true, delayToRecycle=true and
immediatelyFinishEffect=false. The complete native _FinishAndRemoveBuff path
removes the matching list entry, removes the current instanceUid from the UID
map, then performs those finish effects. It does not branch on the Boolean
results of list or UID-map removal before finishing.

`fearProjectileFinishAndRemoveBuff` composes that selected sequence. It samples
UID again after list removal, marks finish with override-map updates enabled,
then calls OnFinish without immediate effect termination. Only a true OnFinish
result captures ObjectPtr<Buff> and submits it to the next-frame recycle queue.
It does not reset the UID or recycle the object inline. Native queue processing
timing remains explicitly unverified; queue/state/effect receivers remain
mandatory callers. Removing UID-map registration alone does not invalidate an
ObjectPtr whose cached UID still matches the buff object's UID.

`fearProjectileOverrideGroupRemove` preserves the separate group member-removal
Boolean: _DoUpdateInternal runs only on successful member removal. That callback
uses the group's native member equality semantics; it does not substitute the
primary buff list's UID-based matching rule.

Tests cover failed list/map removal results, false/malformed OnFinish results,
current UID resampling, selected flags, capture/queue order, recursion and
owner-life cancellation at each callback. A composed concrete-pointer/list/
finished-cleanup/group test removes registration, queues a still UID-valid
pointer, then removes the member and updates its group; changing the object's
UID later invalidates the queued pointer. The group/state/queue effects in this
composition remain synthetic receivers rather than certified native pool and
override-map execution.

The focused native/fear/family/miner suite passes521 tests and the producer
reproduces with --check. Continuation40521019928 atc40fdc78 has completed
successfully, joining full40514426781 at55cb5385. These older hosted results
do not claim validation of this newer checkpoint. Actual MarkFinish/OnFinish
state/effects, group update, native queue execution, ability setup, complete
controller scheduling and stage geometry remain open. Source/support/catalogue
gates are unchanged.

### Native-frame delayed buff recycling

The75-method artifact adds BattleController.get_fixedFrameCnt,
_UpdateDelayToRecycleBuffContainer, _RecycleBuffContainerImmediatelly, OnTick
and ManualFrameTick. The frame counter and recycle-container key are UInt32;
the container is Torappu.ListDict, not a generic Dictionary type. Enqueue
samples fixedFrameCnt and appends an ObjectPtr value under frame+1, wrapping
UInt32. Update looks up only the current frame, tests each pointer's validity,
locks valid pointers and passes the result to the buff pool. It samples
fixedFrameCnt again before removing a bucket. The List enumerator's complete
MoveNext body retains version checks, including the completion path.

`fearProjectileBuffRecycleQueue` composes that selected keyed queue with explicit
native frame/pointer/pool callers. It does not infer frame numbers from elapsed
float time or process earlier buckets when a frame was skipped. Recycling can
enqueue another pointer into a future frame; adding to the currently enumerated
bucket instead produces the native list-version failure and leaves the bucket
for a later validity check. Pool exceptions do not silently discard the bucket.
The pool receives Lock's result without an invented second null branch. Native
pool null handling remains the pool caller's responsibility.

Tests cover exact-frame lookup, UInt32 wrap, copied pointer values, owner
retirement without cancelling the battle-scoped queue, invalid pointers,
separate validity/Lock calls, future enqueue, same-list mutation, exceptions,
reentry, malformed frame readers and battle-end cancellation. A composed finish
test queues a captured pointer for frame+1, prohibits inline recycling and
verifies that the later pool receiver's UID reset invalidates that pointer.
The fresh removal-frame sample is tested independently of the lookup sample.

The default OnTick body retains its counter increment at0x397e39f and subsequent
queue-update call at0x397eb79; ManualFrameTick retains dispatch to OnTick. This
static call chain does not certify the simulator's live tick-phase alignment.
Native pool/recycle effects, immediate battle-end flush, complete ListDict
context behavior and original live scheduling remain unverified. The local
queue's battle-end release is cancellation safety, not a claim of native flush
parity.

The focused native/fear/family/miner suite passes538 tests and the75-method
producer reproduces with --check. Continuation40524700297 at5be7b022 has
completed successfully; full40524709132 at that same head remains active and
is not replaced. Full fear/controller/stage integration, ability setup and
geometry remain open. No source/support/receipt or catalogue gate changes.

### Buff identity allocation and selected pool recycling

The78-method artifact adds Buff.OnAllocate, OnRecycle and set_instanceUid.
OnAllocate increments UInt32 s_globalCounter, writes that result to the buff UID,
then sets m_isValid atoffset0x1ef. OnRecycle writes UID0 through the setter before
clearing m_isValid. Counter overflow does not skip0. The static counter is
distinct from the per-object instanceUid and is not reset per owner/battle.

`fearProjectileBuffIdentity` implements these default writes on explicit mutable
field projections with one supplied shared counter. It does not infer buff
finished/enabled state or initialize the rest of Buff.Reset. Tests cover shared
counter use across adapters and reused bodies, UInt32 wrap, initial UID0 pointer
rejection, stale pointers after reallocation, malformed/immutable projections
and recycling without reading or changing the global counter.

Three mapped Object canonical pool bodies retain Recycle, _RecycleInternal and
_SendNotification. Static ObjectPool generic-context ranges resolve slot19 to
HashSet.Remove, slot26 to Stack.Push and slot18 to _SendNotification, with slot20
binding _RecycleInternal. The raw16-byte RGCTX definitions and their method-spec
records are retained. Their argument is generic VAR parameter248; that index is
not misinterpreted as a typedef/name by the direct-type decoder. The notification
interface resolves to IReusable, with OnAllocate slot0 and OnRecycle slot1.
Concrete runtime context and live allocation/force-reuse policy remain false.

`fearProjectileBuffRecyclePool` composes the selected default Buff recycle path
with supplied using-set/unused-stack projections. Null or untracked objects
return false. Successful HashSet removal precedes Stack.Push and OnRecycle;
there is no rollback of those mutations if notification throws. Removing the
using membership first also rejects a recursive duplicate while permitting
recycling of another tracked buff. Default Buff equality remains reference
identity; generic/custom comparer behavior is not claimed.

Tests cover null/foreign objects, order visible inside notification, recursive
duplicate and other-object recycling, stack order and notification exceptions.
The queue/pool/concrete-identity composition queues duplicate pointer values but
recycles once, clears UID/validity, and prevents the remaining old pointer from
reaching the pool again. A separate composed null-Lock case reaches the concrete
pool's null gate and returns false without a notification. The focused
native/fear/family/miner suite passes551 tests and the source producer reproduces
with --check. Continuation40526665820 ata3b466e0 completed successfully;
full40524709132 at5be7b022 remains active and is not replaced.

These are selected default pool/identity projections, not certified native live
pool construction, allocation, force reuse, state-reset effects or battle-end
flush. Full ability/controller/stage integration and existing source/support/
receipt/catalogue gates remain unchanged.

### Selected default battle buff-pool allocation

The81-method artifact additionally retains BattleController's complete
constructor, BuffContainer.CreateBuff and Buff's constructor. The battle
constructor binds ObjectPool<Buff>'s constructor specification253089 and the
CreateBuff delegate definition56747, then installs that pool atfield0x90. Its
options set preloadSize100, maxCapacity0 and allowPoolAutoReuse=false.
Options.Prepare changes nonpositive signed capacity to Int32.MaxValue. Its
complete14-byte leaf, including the internal branch to its terminal return,
is separately reviewed without weakening the generic native-code reader.
CreateBuff's new-object type load resolves specifically to Torappu.Battle.Buff.

Mapped Object canonical constructor/Allocate/_CreateNew/_LoadToSize and count
methods are retained. The static generic context also resolves stack count/pop,
Options.Prepare, all-loaded count, creation and using-set Add. Preloading calls
the constructor delegate but does not send OnAllocate. Allocate pops an unused
body first, otherwise creates one body if below prepared capacity. Automatic
force reuse is disabled on this selected path. Using-set insertion precedes the
allocation notification; its Add result is ignored before notification/return.

`fearProjectileDefaultBuffPool` implements these selected options with explicit
construction and allocate/recycle receivers. It preloads100 bodies, skips null
factory returns, allocates from the unused stack and grows by one when the
preload is exhausted. It does not generalize unrelated pool options or infer the
full Buff constructor/Reset effects. The existing concrete UID identity receiver
can supply OnAllocate and OnRecycle without resetting the shared static counter.

Tests verify preload without UID allocation, LIFO order, fresh UID on reused
bodies, exhaustion without force reuse, null and throwing factories, committed
membership after allocation-notification failure, ignored duplicate Add results
and nested allocation. A composed default-pool/finish/native-frame-queue test
allocates a preloaded body, defers recycling to frame+1 and reallocates that same
body under a new UID while the old pointer remains invalid. The focused
native/fear/family/miner suite passes560 tests and the source reproduces with
--check. Continuation40529910533 atfa0971c2 completed successfully;
full40524709132 at5be7b022 remains active and is not replaced at this checkpoint.

Actual native constructor/Reset data effects, live pool phase/initialization,
full ability/controller/stage integration, battle-end flushing and geometry
remain unverified. Static selected allocation behavior does not relax existing
source/support/receipt/catalogue gates.

### Explicit immediate delayed-buff recycling

The retained controller `_RecycleBuffContainerImmediatelly` enumerates every
stored ListDict pair and its pointer list, independently of fixedFrameCnt.
Seven exact metadata loads bind the concrete nested UInt32 / List<ObjectPtr<Buff>>
signatures for the emptiness check and both enumerators. Their concrete method
specifications have no native mapping. The separately retained shared outer
MoveNext checks its List version on both normal and terminal traversal; the
existing inner MoveNext does likewise. This bounded nested signature decoder
does not change the general direct-type specification reader.

`flushImmediately` now provides the explicit selected queue cleanup operation.
It visits buckets in stored insertion order, copies each pointer value, tests
validity, independently locks it and passes that result to the selected pool.
The queue clears only after successful traversal. Exceptions retain all buckets,
while already completed recycle effects stay committed. A new bucket changes
the outer version; appending to the current list changes its inner version;
appending to a later existing list is visible when its enumeration begins.
Both traversal entry points reject recursive traversal. Local battleEnd still
cancels outstanding work rather than guessing the controller cleanup phase.

Tests compose the operation with the default pool and UID receivers, including
duplicate pointers across different frame buckets, fresh UID after reallocation,
skipped-frame cleanup, stored order, null Lock, exceptions/retry, inner and outer
mutation, later-list mutation and local lifecycle cancellation. All573 focused
native/fear/family/miner tests pass; the81-method evidence bundle reproduces
with --check. The prior full40524709132 at5be7b022 completed successfully.
Full40533531161 and continuation40533531826 check d74e28a3 independently.

Native controller cleanup timing, Reset effects and full controller/stage
integration remain open. No source/support/receipt/catalogue gate changed.

### ClearRunTimeData default cleanup ordering

Static direct-call review locates immediate delayed-buff recycling inside
BattleController.ClearRunTimeData at396f137. The complete method and its
rune-manager/global-blackboard getters are now retained in the84-method artifact.
Metadata/native pointer bindings identify the logger, rune, global-object pool,
blackboard, global environment and shader effects plus the resource and static
cleanup methods. These bindings do not certify the subsystem implementations.

The selected default path clears the logger and runes, then indexes the live
global-buff list. It checks native object destruction/null semantics before
PoolManager.Recycle, and reads the live count again after every iteration rather
than taking a snapshot. It clears that list before resetting the global
blackboard, removing all global environments, resetting all spine shaders and
clearing held resources. Immediate delayed-buff recycling follows; static cleanup
is a tail call only after that operation succeeds.

`fearProjectileClearRuntimeData` composes these ordered effects through required
native subsystem receivers. It supports a live global-buff list, skips destroyed
objects, preserves completed effects after exceptions, and prevents recursive
cleanup. It runs explicitly before the local battleEnd cancellation; no native
end-request scheduling or live subsystem wiring is inferred. The queue composition
verifies pending pointers are recycled after held-resource cleanup and before
static cleanup. Tests also cover list growth/shrinkage, retry after a flush error,
malformed native count/validity results and cancellation at every receiver.
All594 focused native/fear/family/miner tests pass and --check reproduces the
84-method evidence. Full controller/stage integration, live lifecycle phase,
subsystem effects and Buff.Reset remain open; all existing gates remain intact.
