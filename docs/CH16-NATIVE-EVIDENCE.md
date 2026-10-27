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
`fearpj_m0_t[switch_to_die]` template and 202 complete default node/runner/entity/mode/FSM
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

### Blackboard numeric reads and default duration/trigger getters

The113-method artifact additionally retains _TryGetNumber, TryGetInt and the
complete numeric-predicate tail wrapper. Numeric eligibility uses
String.IsNullOrEmpty(valueStr), so an empty string is numeric-eligible. The
number scan skips matching nonnumeric pairs and can find a later numeric
duplicate. After its predicate it reads the indexed value again. Missing/null/
empty keys produce false and a zero out float. TryGetFP converts that out float
even on failure; GetFpOrDefault performs conversion before fallback selection.
TryGetInt skips rounding when lookup fails. Its round and Int32 conversion
instructions are retained, without certifying a replacement rounding policy.

`fearProjectileBuffBlackboardReads` implements the selected pair-list scan and
default getter orchestration, with explicit native comparison, FP conversion,
integer rounding and lifecycle receivers. Numeric reads use float32 values,
preserve found/out results and reject reentry across getter kinds. The unused
default-branch Boolean remains accepted without inventing behavior from its
hotfix-only use. Culture/rounding/FP effects remain unverified receivers.

Tests cover nonnumeric and numeric duplicates, empty-string values, missing-key
out values, conversion-before-fallback, default flags, repeated pair reads,
float32 rounding inputs, exceptions/retry, reentry and lifecycle cancellation.
A composed write/read/lifetime/trigger test supplies Reset from the concrete
pair operations. All693 focused native/fear/family/miner tests pass and --check
reproduces the113-method bundle. Full native conversions, list versioning, full
Reset and live controller/stage integration remain open; all gates are intact.

### Concrete FP conversion and floor-to-Int32 results

Further review identifies the TryGetInt callee at4d00c4 as a floor scalar path,
not nearest-integer rounding or truncation. The complete176-byte body has44
instructions, retains its finite branches and external NaN tail, and uses exact
double constants-1 and1. The FP(float) leaf multiplies float32 by4294967296
then converts with CVTTSS2SI. These constants and complete leaf bytes are now
retained in the113-method artifact's separate scalar-conversion records.

`fearProjectileFloatToRaw` implements float32 multiply and signed truncation,
including x64's signed64 indefinite result for NaN/overflow. The integer helper
first narrows to float32, floors that value as double, then projects CVTTSD2SI's
Int32 result, including its indefinite result. These are now the default scalar
receivers for the blackboard reads and Reset lifetime/trigger conversions.
Instrumentation may still supply native receivers. The integer receiver and
source key are renamed floorToInt/intFloorCallRva to express the verified path.

Tests cover positive/negative fractional values, float32-before-floor behavior,
sub-tick FP values, signed range boundaries, NaN/infinities, indefinite results
and negative zero. A default-conversion read/lifetime/trigger composition needs
no conversion stand-ins. All699 focused native/fear/family/miner tests pass and
--check reproduces the113-method evidence. Floating-point exception/CRT NaN
diagnostic effects and live runtime floating-point mode are not certified.
Culture comparison, full Reset, controller/stage integration and existing
source/support/receipt/catalogue gates remain unchanged.

### Ordinary pair assignment and key membership

The retained Assign(IReadOnlyList<DataPair>) default path preserves whole source
pairs, unlike numeric/string overloads that lower keys and clear alternate value
fields. An empty destination dispatches to List<DataPair>.AddRange; the exact
mapped specification117463 binds that call. A nonempty destination copies the
source pair before its destination comparison loop, replaces the first matching
pair in place or appends, and preserves source casing and both value fields.
ContainsKey compares keys independently of numeric/string eligibility.

`fearProjectileBuffBlackboardPairs` implements these selected array-projection
operations and clear. Empty-destination assignment preserves duplicates and
copies pair values; nonempty assignment follows live indexed source/destination
lists. Culture comparison remains explicit. List capacity/version behavior,
general IEnumerable AddRange behavior and runtime array projection parity are
not certified by this internal selected model.

Tests cover duplicate/case/value preservation, whole-pair replacement, nullable
keys and string membership, captured source pairs, exceptions/retry, reentry
before lifecycle probes and cancellation. A composed ordinary Reset uses these
storage operations, numeric reads/default conversions, heavy-enemy lifetime
modification, trigger configuration and concrete timer initialization together.
All707 focused native/fear/family/miner tests pass. The113-method evidence bundle
reproduces; full Reset and live controller/stage integration remain open. No
source/support/receipt/catalogue gate changed.

### Buff.Reset action-array loading

The114-method artifact additionally retains Buff._LoadActions. It clears
indices0..103 of m_actions, rereading the array for each clear. ActionDict
get_Count/get_Item specifications bind Event and EventToAction arguments without
fabricating concrete native mappings. The selected enum conversion is a reviewed
complete three-byte Int32 identity leaf. Each dictionary iteration captures the
destination array, reads an entry for its event, reads the entry again for its
action-array reference, performs native assignability checking for nonnull
actions, then writes the selected event slot. Later duplicates overwrite earlier
ones; null actions still write a slot. Dictionary count is sampled each loop.

`fearProjectileLoadBuffActions` implements that selected sequence with explicit
native dictionary, EventToAction-value and assignability receivers. It does not
clone or run action arrays. Earlier clears/writes survive errors, short arrays
fail at their first out-of-range clear, and type checking precedes event bounds
checking for nonnull actions. Lifecycle invalidation stops at each receiver and
recursive loading is rejected.

Tests cover exact clear extent, retained action identity, duplicates/null actions,
separate event/action reads, live destination and dictionary changes, range/type
errors, missing wrappers, retry, reentry and lifecycle cancellation. All722
focused native/fear/family/miner tests pass; --check reproduces the114-method
bundle. Continuation40542047673 atcd06bdff passed; existing full40540699414 at
e8664584 is still active. Full Reset, native dictionary/array type effects and
live controller/stage integration remain open. All gates remain intact.

### Attribute arrays, abnormal masks and modifier formulas

The117-method artifact additionally retains _LoadAttributesModifier,
_CalcAbnormalMask and _CalcAbnormalCombo. FormulaItemType is resolved from the
actual modifier field, avoiding an ambiguous same-named enum. The initial scaler
constant is pinned as float1. Complete reviewed FP multiply/add/comparison leaves
and the negative-scaler conversion body are retained separately.

`fearProjectileLoadBuffAttributes` rebuilds the five independent abnormal masks
with native low-six-bit shift semantics, clears the attribute mask and resets
38 entries of additions/final-additions/multipliers to zero and final-scalers to
one. It loads modifier values from the selected blackboard key when configured,
rereads the default after unsuccessful lookup, applies signed stack scaling and
routes all four formulas to their selected accumulators. Negative final scalers
become1+value; nonnegative values remain factors. Contributions accumulate with
signed64 wrap and native Q32.32 multiplication.

Source-fetched formulas use the native source attribute: additions add it,
multipliers multiply it into an addition, and final-scalers multiply it into a
final addition. Invalid source pointers skip those modifiers entirely. A final
source snapshot callback follows all modifiers and is skipped for invalid
sources without inventing snapshot clearing. Native source/blackboard key/
snapshot effects remain explicit receivers.

Tests cover all formulas with/without source, stacks/scaler products, enum masks,
exact clear extent, lookup mutation/fallback, fixed-point floor and overflow,
invalid sources, unknown formula mask behavior, partial array failures, reentry,
retry and lifecycle cancellation. All746 focused native/fear/family/miner tests
pass. Full Reset, native source snapshot effects and live controller/stage
integration remain open; all source/support/receipt/catalogue gates are intact.

### Buff priority calculation and capped stack updates

The121-method artifact additionally retains _CalculatePriority, _DoUpdateStack,
BuffData.get_isAutoPriority and FP's static constructor through the correct
Torappu.Common image. Negative configured priority selects automatic calculation.
With no priority keys it sums38 signed additions/multipliers/final-additions;
final-scalers are excluded. With keys it sums each native FP lookup's absolute
value, using fallback0 and the selected Boolean true. Both automatic paths
multiply by the pinned float1000 and use FP ties-to-even rounding to Int32.
FP.Abs's minimum-value case uses native MaxValue raw7ffffffffffffffe, rather
than inventing an unrepresentable positive counterpart.

`fearProjectileBuffPriority` implements those selected calculations with signed64
wrapping and concrete FP multiplication/absolute/rounding operations. Data/key
and lifecycle reads remain explicit. `fearProjectileUpdateBuffStack` preserves
the native cap guard: a stack count above a nonnegative maxValidStackCnt skips
recalculation without clamping the count. Otherwise it reloads modifiers with
the current count, gets owner attributes, reads the resulting attribute mask and
marks that mask dirty. It does not silently skip a missing owner.

Tests cover explicit priority, signed sums, per-key absolute values, scale and
tie rounding, minimum/overflow values, live key changes, cap/negative-cap cases,
retry, reentry and cancellation. A concrete stack/attribute/priority composition
verifies stack-scaled modifiers and dirty-mask notification before calculating
priority. All761 focused native/fear/family/miner tests pass; --check reproduces
the121-method evidence bundle. Native owner dirty effects, full Reset and live
controller/stage integration remain open. All existing gates remain intact.

### Status resistance and slowdown initialization

The124-method artifact additionally retains _InitIsStatusResistable,
_AutoCalcIsStatusResistable and _InitCanSlowDown. Exact initializer field-reference
usages resolve through the metadata FieldRef table to private16-byte constants.
The automatic-resistance array is [0,16,43,41]: STUNNED, FROZEN, DOZE, ATTRACTED.
The separate resistable array is [0,16,23,43]: STUNNED, FROZEN, COLD, DOZE.
The StatusResistable byte enum is retained through a bounded unsigned-byte
decoder, leaving the shared signed-Int32 enum reader unchanged.

`fearProjectileInitBuffStatus` handles NO/YES/AUTOMATIC and unknown byte values.
Automatic mode snapshots the flag count, reloads the flag array and abnormal mask
per iteration, and preserves the signed-positive TEST/JG bit predicate. It writes
the resulting status-resistance flag before slowdown initialization. Only a
resistable buff reads its current template and the configured slowDownTemplateKey;
native nullable ordinal inequality excludes that exact template from slowdown.
The config field binding and complete String.op_Inequality body are retained.

Tests cover exact automatic flags, nonautomatic statuses, explicit/unknown modes,
nullable/case-sensitive template exclusion, live flag-array reads, bit63 behavior,
partial writes on config failure, reentry, retry and cancellation. An attribute-
mask/status composition verifies the status decision uses the initialized mask.
All775 focused native/fear/family/miner tests pass; --check reproduces the
124-method bundle. Continuation40545156330 at3b7defc7 passed; existing
full40540699414 ate8664584 is still active. Native config effects, full Reset
and live controller/stage integration remain open; all gates remain unchanged.

### Inner initialization, reset and delayed birth

`extract-windows-fear-projectile-inline.py --check` retains complete _InitInline,
set_currentTime and _DelayToBorn bodies. The first two match the existing
projectile evidence byte for byte. Lifetime/max-hit/retained-hit-time/birth slots
resolve on SimpleProjectile, not abstract Projectile slots. The bundle binds
HitBehaviour's Init slot, IBattleRandom.Range slot8, the dictionary-clear usage,
the delayed-birth method definition and cross-image FP/MathUtil/Unity calls.
The checked Fear component has zero random delay, _managedBySource=0, limited
ten-second lifetime and the existing unlimited hit-number configuration.

`fearProjectileInlineInit` resets time/hit counters and stop/reached flags before
clearing hit storage and callback references. Callback and behavior traversals
read fresh arrays and live lengths after each store/callback. Lifetime is
converted through the supplied checked FP conversion, max hits remain Int32,
and retained-hit time remains raw Q32.32. The body transform is sampled before
storing retained-hit time; an existing nonnull transform is reread after the
Unity query. Trace setup precedes behavior Init(start,target,projectile), the
initialized flag and outer adjustable settings.

Random-source selection occurs even at zero delay. The maximum delay is reread
after IsZero and before a required random receiver is checked. Native IsZero/GT
semantics and Range remain explicit callers. Nonpositive sampled delay calls
OnProjectileBorn immediately; positive delay deactivates the GameObject before
constructing and scheduling the born action. _DelayToBorn reactivates the
GameObject before the virtual birth call. No extra one-shot, cancellation or
pool-identity guard is inferred from these default bodies; scheduler/lifecycle
ownership remains to be proved separately. Exceptions retain prior writes,
initialization and deactivation effects.

Tests cover reused-state reset, changing arrays, partial failures, body-transform
sampling, deterministic/trivial random selection, delay rereads, immediate and
scheduled births, callback replay and failed action/scheduler creation. The
longer controller/Init/flight composition now runs this inner layer before its
explicit birth receiver. It uses the canonical unmanaged-source and zero-delay
Fear settings, checks reset/lifetime/behavior state at birth, and still verifies
damage after event5 source death. Separate diagnostic tests continue to cover
managed-source registration. All1468 focused native/fear/family/miner tests,
evidence reproduction and the three Fear/miner contract checks pass.

SetTraceTarget, behavior Init, outer adjustable settings and OnProjectileBorn
runtime effects, native collection/random/math/Unity/scheduler effects, pool
allocation/reuse, initial FSM, base target actions, no-target fallback,
local-miner attachment and stage/frame parity remain open. Trace-target/birth
setup and the underlying pool path are next. No controller/stage admission or
source/support/receipt/catalogue gate changed; stage registries are unchanged.
This checkpoint is local and has not been uploaded or run in hosted CI.

### Projectile Init references, positions and ownership

`extract-windows-fear-projectile-init.py --check` retains the complete default
Projectile.Init body and key/original-key/damage-miss setters. It binds their
backing fields, Entity/Ability pointer Wrap/validity/Lock usages, ILocatable
position/height slots0/5, BObject side/playerSide fields and Init parameters,
Character casts, logger parameters and Enemy's concrete managed-projectile
getter. Abstract Entity slot52 is not accepted as a concrete implementation.
The unchanged controller evidence independently names this Init entry point.

`fearProjectileInit` writes keys before validating the ability, wraps the owner
into the source pointer, samples source position, wraps the ability and derives
the damage-miss flag through fresh pointer queries. It stores effect-replacement
pairs and the projectile type before action-controller initialization. Start
position is sampled once for m_startMapPos, then again for BObject.Init after
separate source side/playerSide reads; height follows the second position.
The inner initializer receives target then start. Reference writes expose their
barriers; no cancellation guard or exception rollback replaces the native order.

After inner initialization, logger lookup precedes log-id capture and fresh
source queries. Source id uses a fresh pointer lock after Unity validity. The
Character path repeats its cast checks and delegates Int32 mode formatting;
fallback strings and ability extra-data lookup remain explicit. The logger is
checked only after those inputs are gathered. Managed-by-source registration
runs after logging, rechecks current pointer validity, reads the source's list
and captures the projectile pointer before checking that list for null.

Tests cover partial writes on null receivers/errors, source/ability replacement,
zero-source-position failure, separate side/playerSide and start reads, logging
capture order, Character mode queries, ownership invalidation and nested Init.
The wait/spell-start/controller/factory/ranged-flight composition now executes
this Init layer before its explicit inner-initializer receiver. It verifies
source/ability pointers and start position at inner setup, ability tracking
before event5 and damage after source death. All1455 focused native/fear/family/
miner tests, evidence reproduction and the three Fear/miner contract checks pass.

Projectile._InitInline, BObject/ActionController initialization effects,
PoolManager allocation/reuse, pointer/static/log/managed-list runtime effects,
initial FSM, base target actions, no-target fallback, local-miner attachment and
stage/frame parity remain open. The next birth-path work is _InitInline and
the underlying pool path. No Fear controller or16-9 admission or source/support/
receipt/catalogue gate changed; stage registries are unchanged. This checkpoint
is local and has not received hosted validation or been uploaded.

### Controller/factory projectile birth and graphic attachment

`extract-windows-fear-projectile-controller.py --check` retains complete default
BattleController.CreateProjectile, BattleFactory.CreateProjectile and
Projectile.AttachGraphicProjectile bodies. It binds source GetEffectReplacePairs,
TryHookProjectile and GetMountPoint slots, Init's seven parameters and the
NORMAL/ONLY_LOGIC/ONLY_GRAPHIC enum0/1/2. Factory calls bind through the actual
Torappu.Common and UnityEngine.CoreModule pointer tables, including FileUtil.Combine,
Component.get_transform, Unity equality/inequality and Transform parent/scale
setters. The PoolManager.Allocate<Projectile> specification has no concrete
native mapping; none is invented. The prefab folder literal and Vector3.oneVector
static field are retained with their metadata usages.

`fearProjectileControllerCreation` samples Unity source nullness before obtaining
effect-replacement pairs, then separately samples source validity before trying
the projectile hook. Normal creation allocates by the original key, conditionally
initializes a valid body as NORMAL and clears the graphic output last. Hooked
creation allocates logic then graphic using separately fetched factories,
publishes the graphic output before validity checks, obtains the source muzzle
mount and initializes logic/graphic bodies with their distinct keys, starts and
type flags. Both retain the original key and earlier effect-pair reference.
Attachment rereads the graphic output after Init callbacks. Failed hook births
report failure and return the logic result without retry, fallback or rollback.
Exceptions retain allocated bodies and any already published output.

`fearProjectileFactoryCreation` combines the canonical projectile folder with
the key, delegates typed pool allocation, and returns null for Unity-null results.
It obtains a transform, parents it to the factory folder, obtains the transform
again and copies the supplied native oneVector components into a separate
Single-valued scale. Parenting survives later failure. The second transform
is checked after fetching the static field view but before reading its components.
`fearProjectileAttachGraphic` stores the nullable reference before its explicit
write-barrier receiver. Controller output stores/clears also expose their barriers.
Pool, Unity, hook, static vector initialization and GC effects remain explicit.

Tests cover normal/hooked creation, separate factories, output publication and
rereads, invalid births, no automatic fallback, Init/report/transform failures,
preserved effects and nested allocations. The wait/spell-start/ranged-launch/
event5-self-death/flight composition now runs through controller and factory
creation before its explicit typed-allocation and Projectile.Init receivers.
It checks parenting/scale before Init, tracking before event5 and damage after
source death. All1438 focused native/fear/family/miner tests, source reproduction
and the existing three Fear/miner contract checks pass.

Full Projectile.Init, pool allocation/reuse/reset, source hook effects, base
target actions, no-target fallback, initial FSM, local-miner attachment and
stage/frame parity remain open. The next birth-path work is Projectile.Init
and PoolManager's actual allocation path. No Fear controller or16-9 admission,
source/support/receipt/catalogue gate, or stage registry changed. This checkpoint
is local and has not received hosted validation or been uploaded.

### Ranged projectile destinations and creation wrapper

`extract-windows-fear-projectile-launch.py --check` reproduces the complete
default RangedAttack.OnCastOnTarget and CreateProjectile bodies from the pinned
Windows client. The former matches the unchanged cast-lifecycle record. The
new bundle binds destination enum0..4, CreateProjectile/GetProjectileKey slots,
Enemy's concrete root-tile getter, Entity.GetMountPoint, position constructors,
the BattleController creation signature, event40 ON_CREATE_PROJECTILE and
generic metadata usages. A bounded nested argument check binds
List<ObjectPtr<Projectile>>. Concrete method-spec mappings remain absent rather
than being inferred from shared code. The checked Fear prefab selects TARGET,
projectile_enemy_fearpj, mount type2, no mount group, no creation event and no
input-position/root-tile fallback emission.

`fearProjectileRangedTargetCast` invokes the base action callback with null
buffs/attachments, then samples the destination. It implements target hit-mount,
input Vector2, target Vector3, root-tile and target-XY/tile-height destinations.
Unknown enum values follow the target branch as the native body does. Position
construction/boxing remains explicit. The primary projectile list is captured
at the branch-specific native point; a nullable creation result is converted
to an ObjectPtr and appended without a Unity-validity filter. A valid fake
projectile is captured independently and appended to a freshly read list.

`fearProjectileCreateProjectile` captures controller, key and source owner in
order before choosing the shoot mount. A mount group samples SafeCount then
the current index, rereads its cache, increments before indexed access and
queries a fresh owner. Exhausted groups use the configured mount type. The
controller receives the earlier captured source, selected mount, destination,
ability and fake-projectile out reference. The creation-event flag is read
after creation; when set, a fresh owner/event pool emits event40 even for a
null creation result. Exceptions preserve prior effects and no cancellation
guard suppresses list append when a creation callback invalidates the source.

Tests cover all destinations, nullable target/root-tile cases, position/list
sampling order, primary/fake pointers, owner replacement, group exhaustion and
failed indexing, null controller/event pool, callback errors and nested births.
The longer wait/spell-start/target-loop/event5-self-death/flight composition now
uses both ranged wrappers before its explicit BattleController creation
receiver. It checks projectile tracking before event5 and damage after source
death. All1422 focused native/fear/family/miner tests, evidence reproduction and
the three Fear/miner contract checks pass.

BattleController allocation/reset, mount/FixedPosition runtime effects,
projectile-list native storage/growth, the RangedAttack no-target fallback,
base target-action application, hotfix dispatch, initial FSM and stage/frame
parity remain open. This wrapper composition does not admit the Fear controller
or16-9. All source/support/receipt/catalogue gates and stage registries stay
unchanged; this checkpoint remains local.

### Standard spell-start orchestration

`extract-windows-fear-spell-start.py --check` reproduces the complete selected
default AbilityStandard.OnSpellStart body from the unchanged cast-lifecycle
bundle and pinned Windows client. It binds owner CanDoAbilitySpellOn slot133,
its by-reference FinishReason output, the direct Entity.OnAbilitySpellOn call,
context stack fields and concrete RangedAttack payload slots. GetActiveBuffs
slot44 and GetEventActions slot74 resolve on the concrete type; the shared
resolver still rejects abstract encoded slots. The input field is independently
typed as KeyValuePair<Vector2,ObjectPtr<Entity>>; the native copy at ability+e0
is retained as an observed instruction, without inferring inflated generic
field offsets from zero-offset generic metadata.

`fearProjectileSpellStart` copies the owner before reading the ignore-death
flag, validates it, locks the fresh owner field and checks its rejection reason
before touching context. It pushes ability/source frames through separately
fetched contexts, captures buffs/attachments/event4 actions, and emits event4
with runAction=false. A Unity-valid owner receives OnAbilitySpellOn inside a
main-target frame. The input pointer is copied and that stack captured before
locking; the pop fetches context again. Audio honors first-spell-only behavior.

Target casting receives the captured payloads. The damage/heal field and
allowNoTarget getter are sampled again after output callbacks as in the native
branches; an initially false damage field skips both output branches. The
no-target callback determines the returned Boolean only when casting found no
valid targets. Successful and false-result paths pop source then ability using
fresh contexts. Exceptions preserve already pushed frames: the selected default
body has no exception cleanup. Reentry retains independent local payloads and
results. No extra lifecycle cancellation or automatic frame repair is inserted.

Tests cover owner rejection/replacement, payload capture, changing contexts and
stack fields, nullable input locks, output/audio branches, callback errors and
nested calls. The longer bounded-wait/mode-switch/event5-self-death/independent-
flight composition now runs through this spell-start implementation and the
native target loop before its explicit projectile-construction receiver. It
checks that context frames are popped before event5 and born damage survives
the source's death. All1399 focused native/fear/family/miner tests, evidence
reproduction and the three existing Fear/miner contract checks pass.

RangedAttack projectile construction, native owner/virtual/hotfix effects,
initial FSM, local-miner integration and stage/frame parity remain open.
Source/support/receipt/catalogue gates and stage registries are unchanged;
new stages stay test-only and this checkpoint stays local. The exact previously
approved0524e2b1 remains the remote branch head with full40558578137 and
continuation40558189633 successful; later commits have not been uploaded.

### Standard target-cast loop and finish checks

`extract-windows-fear-target-casting.py --check` reproduces a separate selected
binding from the pinned Windows client and unchanged cast-lifecycle bundle.
It retains complete AbilityStandard.DoCastOnTargets and CheckFinished bodies,
their fields, virtual slots/signatures and concrete metadata usages. A bounded
nested-type check binds List<ObjectPtr<Entity>> without relaxing the shared
direct-type reader. The selector getter is bound to TargetSelector, whose
OnCastedOnTarget slot23 receives the notification.

`fearProjectileTargetCasting` samples live list counts, copies and validates
each pointer through ValidAndAlive, rereads the target list for a fresh indexed
pointer, locks it and invokes OnCastOnTarget with the action/buff/attachment
inputs. The cast flag is set before that virtual call and its void result is
ignored. A selector is sampled for Unity validity, then reread for notification.
CheckFinished follows notification; a finished cast stops without another target
read. Invalid target entries skip casting, notification and the finish check.
Nested casts retain independent loop positions and result flags.

`fearProjectileCheckCastingFinished` returns true for an idle ability. While
casting, it copies the owner pointer before reading _ignoreIfOwnerDead and
invokes the corresponding ValidAndAlive overload. An invalid owner triggers
FinishIfNot(reason2,resetCd=false) and returns true regardless of that receiver's
Boolean result. Its native finish/state effects remain explicit.

Tests cover stale/dead pointers, target-list and selector replacement, nullable
lock results, preserved casts on later errors, nested calls and early finish.
The single-spell continuation now composes the target loop: target effects that
end casting suppress event5/post-delay, while an ordinary successful cast
continues to them. All1376 focused native/fear/family/miner tests and evidence
reproduction pass. The RangedAttack projectile-construction receiver, full
OnSpellStart, initial FSM, native virtual/generic/runtime effects and stage/frame
parity remain open. Source/support/receipt/catalogue gates and stage registries
are unchanged; new stages stay test-only and this checkpoint stays local.

### Self-death graph through immunity admission and enablement

The checked eight-node self-death graph now composes CreateBuff, BuffDB inline
lookup, both Entity.AddBuff overloads, pooled identity allocation and the default
NewBuff/Reset phases. It uses the checksum-retained `empty` template and explicit
retained enum mappings for the immunity configuration. Reset covers context,
blackboard/lifecycle, lifetime/triggers, attribute masks, empty actions, priority,
override, status and final flags. EnsureOverrideGroup and DEFAULT group dispatch
then drive the concrete enabled setter, attribute counters and combo manager.

At the forced-zero-HP receiver, registration and the enabled immunity buff are
already visible: STUNNED/FROZEN/LEVITATE immune counters and SLEEPING combo immunity
are set. Temporary incoming status counters remain suppressed by the native
status query projection, and the combo manager refuses the simulated sleep push.
The lifetime is infinite and the immunity is not status-resistable. Stun,
freeze, levitate and sleep predicate cases stop before pool allocation or UID
registration. The sleep predicate now reads the concrete combo manager state.

Nested buff-start and enabled actions run through managed context guards and
restore all ten stacks. Injected Reset and enable-action errors stop before
suicide while preserving prior allocation/registration/counter effects. Tests
explicitly retire their admitted/partially initialized buffs afterwards,
checking removed immunity, released pool membership, stale UID rejection and
restored context. This explicit test retirement does not certify native Entity
death cleanup. The host HP/state/mode, dictionary/queue, config conversion and
other native receivers retain their existing verification limits.

All1357 focused native/fear/family/miner tests and the fear-affliction,
miner-clock and miner-listener contract checks pass. No native evidence,
source/support/receipt/catalogue gates or stage registry changed. Full cast
launch, initial FSM, controller/frame parity and16-9 admission remain held.
This checkpoint stays local.

### Nested attribute-data and modifier clones

The225-method bundle adds complete AttributeModifierData.DeepClone and
AttributeModifier.DeepClone/constructor bodies. All222 prior method records and
earlier evidence remain unchanged. Metadata binds five status-list fields,
the AttributeModifier reference array and its five scalar fields. Concrete
List<AbnormalFlag/AbnormalCombo> constructor usages remain unmapped metadata
specifications, separately from their retained shared native call target.

`fearProjectileAttributeDataClone` constructs the outer record, probes each
status list, captures its current value before allocating and constructing a
copy, then publishes it with a barrier. Empty fields preserve constructor
defaults. Modifier storage is allocated and published before entries are cloned.
Each iteration captures the destination before cloning, checks nonnull clone
compatibility before destination bounds, stores the entry, then rereads the
source array. Failures retain earlier lists, arrays, entries and allocation
effects. Null clone results are stored without a compatibility call; null source
entries abort before nested allocation.

`fearProjectileAttributeModifierConstructor` sets loadFromBlackboard true before
Object construction. Its clone constructs first, then copies the two Int32
fields, Single value and two Boolean fields in native order. Tests cover nested
storage independence, empty defaults, callback-driven list/array replacement,
partial copies, compatibility/bounds order and constructor/copy errors. BuffDB
clone/merge compositions now use the concrete attribute and modifier adapters
alongside constructor, blackboard merge and typed list growth adapters.
Native status-list construction, runtime allocation/store checks, barriers and
hotfix effects remain explicit or unverified; full controller/stage/frame parity
is still open. Existing source/support/receipt/catalogue gates are unchanged,
new stages remain test-only. All1355 focused native/fear/family/miner tests pass.
This checkpoint stays local.

### BuffData constructor defaults and late base call

The222-method bundle adds complete default BuffData and AttributeModifierData
constructors. All220 prior method records and earlier evidence remain unchanged.
Both template-key metadata loads resolve to the exact `empty` string literal.
Instruction pins retain attribute allocation/construction/publication, reference
barriers, all explicit defaults and BuffData's late Object constructor call.

`fearProjectileBuffDataConstructor` initializes a fresh allocated attribute
record, publishes it and invokes the barrier, then writes statusResistable2,
templateKey `empty`, stack limits1/-1, lifeTimeType1, trigger intervals-1,
waitFirstTriggerInterval true and priority-1 before calling Object's constructor.
It preserves fields the native constructor does not write; zeroed native
allocation remains the caller's responsibility. The default
`fearProjectileAttributeDataConstructor` only delegates Object construction and
does not synthesize lists or modifier arrays.

Tests cover constructor order, unchanged fields, callback mutations, null
allocation/destination, nested construction and retained writes on each failure
boundary. BuffData.DeepClone and both populated/null-blackboard BuffDB merge
compositions now use these constructor adapters with explicit zeroed allocation.
Native allocation, Object construction, hotfix dispatch and barrier effects
remain unverified. Nested attribute cloning and full controller/stage/frame
parity remain open; existing source/support/receipt/catalogue gates are unchanged
and new stages stay test-only. All1339 focused native/fear/family/miner tests
pass. This checkpoint remains local.

### BuffData.DeepClone field identity and nested storage

The220-method bundle adds the complete default BuffData.DeepClone body. All219
prior ordinary records and earlier evidence remain unchanged. Metadata and
instruction pins bind the exact37-field Windows layout,34 scalar/reference
copies, attribute cloning, priority-array cloning/cast and optional blackboard
construction. No fields absent from that pinned layout are silently copied.

`fearProjectileBuffDataClone` allocates and invokes the constructor receiver
before reading source attributes. It delegates attribute cloning, copies typed
Boolean/byte-enum/Int32/Single fields in native order, and preserves nullable
string references with their barrier calls. Priority keys are cloned and cast
when present; null clone results remain null and failed casts abort before
later phases. The suffix flags are read after priority cloning. Blackboard
emptiness is probed, then the current source blackboard is captured before
allocation and passed to the copy constructor. Empty blackboards preserve the
constructor's destination default instead of sharing or assigning the source.

Tests cover source-field changes at earlier barriers, null attributes, nullable
attribute clone results, scalar widths, missing cross-version fields, priority
cast/clone failures, blackboard capture timing and earlier copies retained after
exceptions. BuffDB now composes this clone adapter with MergeTo, typed DataPair
storage and growth for both populated and null source blackboards. Database
source storage remains unchanged by the external merge. Constructor, nested
attribute clone, array clone/cast and blackboard constructor effects remain
explicit receivers; full controller/stage/frame parity is still unverified.
All1327 focused native/fear/family/miner tests pass. All existing source/support/
receipt/catalogue gates are unchanged and new stages remain test-only. This
checkpoint stays local.

### List<DataPair> capacity growth and publication order

All219 ordinary method records and all prior evidence remain unchanged. A new
growth binding retains complete mapped AddWithResize, EnsureCapacity and
set_Capacity bodies for DataPair. The mscorlib List generic-context range binds
slots11/12/24 to the corresponding method definitions through an uninflated
VAR argument, separately from the concrete DataPair specializations. No runtime
generic inflation proof is inferred from the static metadata.

`fearProjectileDataPairListGrowth` selects four slots for an empty list, otherwise
doubles capacity with Int32 arithmetic, clamps using the native unsigned ceiling
comparison, then raises to the signed requested minimum. set_Capacity checks
the current size before loading items and preserves equal-capacity storage.
Positive capacity allocates first, rereads size/items for Array.Copy, then
publishes the replacement and invokes the barrier. Zero capacity uses the shared
empty-array receiver. Size and version are not otherwise modified by this phase.

AddWithResize captures its old size and incremented count before ensuring
capacity, rereads items, writes that captured next count, checks array bounds,
then copies/stores the pair and invokes the barrier. It does not increment
version; outer Add already did so. Direct AddWithResize captures its incoming
pair after capacity work, while outer Add's dispatch supplied a prior value copy.
Tests retain the different failure boundaries rather than rolling back counts,
versions, published arrays or partially copied allocation buffers.

MergeTo now constructs an empty typed list and grows it through four/eight
slots while preserving duplicate replacement and version changes. BuffDB's
external merge composition also exercises the growth chain. Array copying is
composed through the retained managed Array.Copy and native FastCopy adapters
with a24-byte DataPair memory projection. All1310 focused native/fear/family/
miner tests and evidence reproduction pass. Native array
allocation/copy, runtime class initialization, barriers and full controller/
stage/frame parity remain explicit or unverified. All existing source/support/
receipt/catalogue gates are unchanged; new stages remain test-only and this
checkpoint stays local.

### List<DataPair> storage and native mutation ordering

The219 ordinary method records and all earlier evidence remain unchanged.
A separate storage binding retains four complete mapped List<DataPair>
specialization bodies: constructor, get_Item, set_Item and Add. Generic metadata
binds each to the24-byte DataPair element type. Instruction sites pin the
selected _items+0x10, _size+0x18 and _version+0x1c layout and full-pair copies.

`fearProjectileDataPairLists` provides construction, direct count reads,
detached indexed reads, replacements and Add's capacity branch. Construction
calls the base receiver, reads the shared empty array through the runtime type
receiver, publishes that array and invokes the write barrier. It does not reset
size/version fields. Reads and replacements check the unsigned logical index
before loading/checking backing storage. Replacements copy the complete pair,
invoke the barrier, then increment the current version with Int32 wraparound.

Add increments version first, captures items before reading size, then either
writes size before copying/storing the new pair or dispatches a copied pair to
the explicit AddWithResize receiver. Errors retain native earlier mutations;
there is no rollback or synthesized successful growth. Tests cover null storage,
logical/array bounds, pair/barrier errors, version overflow, receiver replacement
and growth failure. MergeTo and BuffDB's external-blackboard composition now use
the typed list adapter, verifying first-match replacement and append versions
while leaving database source storage unchanged. Runtime type initialization,
write barriers, capacity growth and full controller/stage/frame parity remain
explicit or unverified. Existing source/support/receipt/catalogue gates are
unchanged and new stages stay test-only. All1298 focused native/fear/family/
miner tests pass. This checkpoint remains local.

### Blackboard.MergeTo external-value composition

The219-method bundle adds the complete default Blackboard.MergeTo body. All218
prior bodies and earlier evidence remain unchanged. Metadata loads bind the
concrete List<DataPair> constructor, get_Item, set_Item and Add specializations
and their mapped entries. DataPair occupies24 unboxed bytes: key+0, Single
value+8 and valueStr+16. Instruction pins retain the early null-source return,
constructor-before-publication order, live source/destination counts, copied
source pair, ignore-case comparison and destination reread before replacement.

`fearProjectileBlackboardMerge` does nothing for a null source before accessing
the destination. A null destination gets a newly initialized list even when
the source is empty. Every source pair is copied and processed separately;
there is no empty-destination AddRange shortcut. Consequently later duplicate
keys replace the first matching entry rather than surviving as duplicates.
The incoming key's casing and all value fields replace that entry together.
Comparison uses an explicit native Int32/ignore-case receiver. List operations
remain explicit receivers with their own storage/versioning and bounds effects.

The adapter preserves captured destination receivers for item reads and append,
but rereads the destination after a matching comparison before replacement.
Tests cover callback-driven replacement, source growth, aliasing, nested merges,
constructor failure, bounds/null failures and retained partial writes. BuffDB's
external-blackboard composition now uses this adapter after config publication.
Native allocation/list storage, culture comparison and full controller/stage/
frame parity remain unverified; existing source/support/receipt/catalogue gates
are unchanged and new stages stay test-only. All1286 focused native/fear/family/
miner tests pass. This checkpoint remains local.

### BuffDBUtil inline identity and cloned database entries

The218-method bundle adds both complete BuffDBUtil.TryGetBuff overloads. All216
prior bodies and earlier evidence remain unchanged. New bindings pin BuffData's
buffKey/loadFromDB/templateKey/blackboard fields and identify the TryGetTemplate,
BuffData.DeepClone and Blackboard.MergeTo receivers. Instruction sites preserve
inline template lookup, zero-config failure, database source lookup, template
lookup, clone, publication and the later external-blackboard merge separately.

`fearProjectileBuffDatabase` preserves inline BuffData identity and returns its
resolved template without cloning or merging. Database-backed data captures the
external blackboard before the key and invokes the key overload. That overload
looks up source data and its template, rereads the source after template lookup,
clones it, and publishes the config before merging external blackboard values.
The merge receives a by-reference local blackboard, then the output data is
reread for the final write. Failures clear both config references only on the
native false-result paths; exceptions preserve earlier publication/effects.
Each nested lookup owns independent data/template output cells.

The CreateBuff -> Entity.AddBuff -> NewBuff composition now uses the retained
self-death immunity BuffData and the SHA-256-checked `empty` template from the
original projectile graph. Its inline path uses the new lookup adapter for
successful admission, abnormal rejection and recycled status rejection. Native
database/singleton/template loading, DeepClone and MergeTo effects remain
explicit receivers, not inferred runtime proof. All1272 focused native/fear/
family/miner tests pass. Full controller/stage/frame
parity remains open. All source/support/receipt/catalogue gates are unchanged;
new stages remain test-only and this checkpoint stays local.

### Entity.AddBuff overloads and container admission bridge

The216-method bundle adds both complete Entity.AddBuff overloads and the
default Entity.get_buffContainer body. All213 prior bodies and prior evidence
remain unchanged. Metadata binds the two signatures (BuffData versus BuffConfig)
and BuffDBUtil.TryGetBuff's by-reference BuffConfig output. BuffConfig retains
its two reference fields at unboxed offsets0/8; the entity container backing
field is+0x150. Instruction pins distinguish the zero-initialized lookup output,
copy into the config overload, container lookup, second config copy and NewBuff
dispatch. The missing-config branch retains its separate diagnostic/throw path.

`fearProjectileEntityAddBuff` forwards the data lookup's Boolean result, copies
the resolved config before calling the config overload, then reads the current
container before copying the overload's config to NewBuff. A failed lookup invokes
the mandatory throwing exception receiver before any entity/container access.
Nullable template/data fields and nullable NewBuff results are preserved.
Nested calls use independent output storage. `fearProjectileEntityBuffContainer`
reads the bound backing field directly and preserves a null stored container.

Composition tests now run CreateBuff through both Entity overloads into the
existing NewBuff pipeline. They verify successful list/UID registration and
enabling, pre-allocation abnormal rejection, and status rejection with recycling;
CreateBuff's action result stays true after each completed attempt. Additional
tests cover copy timing across reentrant container getters, null containers,
lookup failures, invalid results and callback errors without synthetic retries.
The database lookup and native exception construction remain explicit receivers;
their effects and full controller/stage/frame parity are not certified here.
All1260 focused native/fear/family/miner tests pass. All source/support/receipt/
catalogue gates remain unchanged and new stages stay
test-only. This checkpoint remains local.

### CreateBuff action and nullable admission results

The213-method bundle adds complete CreateBuff.get_data, Buff.get_ability,
Buff.get_sourceProjectile and Projectile.get_effectReplacePairs bodies. All209
prior method records and all prior evidence remain unchanged. New bindings
retain CreateBuff's eight instance fields, Buff's Ability/Projectile pointer
fields, BuffData.overrideEffectKey, the virtual data slot8, Blackboard copy
constructor and exact Entity.AddBuff/AddDerivedBuffSafe signatures. The two
new pointer getters bind concrete ObjectPtr<Ability/Projectile>.Lock metadata
specifications separately from their shared native tail.

`fearProjectileCreateBuffNode` resolves and validates its owner before further
work. It inherits source, then rereads the parent for ability; an optional
special source can replace the inherited source with null. Effect replacement
reads data before copying the incoming blackboard, probes and rereads the
projectile pair array, and captures each pair value before comparing its key.
The final virtual data read occurs after blackboard construction. Projectile
inheritance and derived linkage each reread the current parent at their native
positions. Nullable admission and derived parent/child values are forwarded to
their explicit receivers. Once admission and optional linkage return, Execute
returns true even if admission produced no buff. An invalid owner returns false.

All eight nodes of the selected self-death graph now use action adapters in the
checked context-stack composition. A null admission result still proceeds
through AlwaysNext to suicide, and context restoration survives the owner death.
Tests also cover reentrant parent changes, effect-array replacement, copied
pair values, constructor/data/admission/linkage errors and required null checks.
All1246 focused native/fear/family/miner tests pass. Evidence reproduction and
comparison preserve the earlier records. Native allocation, blackboard-copy,
virtual data, equality, admission and derived-link effects remain explicit
receivers; full controller/stage/frame parity is still unverified. All source,
support, receipt and catalogue gates remain unchanged. This checkpoint is local.

### InstantKill action and separate Entity suicide body

The209 ordinary bodies remain unchanged. New bindings identify RallyPoint as
the optional cast type, its Withdraw virtual slot215 with Boolean arguments
switchToDeadState/force/manual/logAutoWithdraw, and Entity.FinishWithReachExit
slot92 with switchState. Entity.m_isSuicide is bound to Boolean field+0xd1.
Instruction pins retain selection, branch precedence, argument reads and the
final virtual alive query separately from Entity.Suicide's own alive probe.

`fearProjectileInstantKillNode` selects the raw snapshot source when _killSource
is set, otherwise delegates target selection, then checks Unity validity and
casts to RallyPoint. The optional RallyPoint branch returns its configured
in-mode result or Withdraw(false,false,true,false)'s Boolean directly, without
an alive query. Normal Entity dispatch prioritizes finish-with-no-reason over
reach-exit over suicide. It then returns the virtual alive result after the
effect. A completed kill can therefore return false, while a surviving or
reborn entity can return true; no kill-success receipt is invented.

`fearProjectileEntitySuicide` implements only the default Entity body: probe
alive once, mark m_isSuicide, then dispatch forced raw-zero HP with noSource and
skipReborn. Its caller owns any post-effect alive query. The HP receiver still
owns native FP encoding and HP/death effects. The existing lifecycle wrapper
remains unchanged. The checked self-death action graph now uses these two
receivers for InstantKill, preserving context restoration after the owner dies.

Tests cover direct source selection, invalid targets, RallyPoint early returns,
finish precedence, suicide flags, nullable receivers, effect errors and the
mark retained after HP failure. Concrete RallyPoint/finish/HP effects, native
exception construction and full controller/stage/frame parity remain unverified.
Source/support/receipt/catalogue gates are unchanged; this checkpoint stays
local outside pending upload authorization.

All1228 focused native/fear/family/miner tests and evidence reproduction pass.

### SwitchMode action and void Unit dispatch

The209-method ordinary bundle adds Unit.SwitchToDefaultMode's complete wrapper;
the indexed Unit.SwitchMode and action-node bodies remain unchanged. Metadata
binds their signatures to void SwitchMode(index,restartFSM) and void
SwitchToDefaultMode(restartFSM). Trailing zero ABI registers are method-info
arguments, not extra Boolean controls. Checked metadata usage binds the Unit
cast type and string literal31621 to the exact UTF-8 key "mode".

`fearProjectileSwitchModeNode` selects a target, casts nonnull entities to Unit,
then rejects Unity-invalid Units before reading mode configuration. Optional
TryReadInt starts with an out Int32 value0; success uses its output and failure
rereads/stores the literal _modeIndex fallback. That selection occurs before
the restore-default branch, including blackboard access when restoring default.
The restart flag is read after lookup effects. A completed void Unit dispatch
returns action success=true even if the Unit adapter reports no actual change;
exceptions still propagate. This keeps Unit-operation results separate from
the action's Boolean condition result.

Tests cover invalid/null casts, literal and blackboard indices, failed lookup
output replacement, restore ordering, mutable flags and exceptions. The checked
self-death graph now runs its SwitchMode node through target selection and this
adapter; a no-change Unit receiver does not prevent later immunity/AlwaysNext/
kill actions. Unit casting, native TryReadInt internals, concrete mode effects,
hotfixes and full live controller/stage/frame parity remain unverified. Source/
support/receipt/catalogue gates remain unchanged and this checkpoint remains
local outside pending upload authorization.

All1222 focused native/fear/family/miner tests and evidence reproduction pass.

### Target getters and by-reference Entity pointer fields

The208-method ordinary bundle adds five complete getters: Modifier source/
target, Ability owner, and Projectile source/traceTarget. Existing Buff source/
owner and BuffContainer owner bodies are retained unchanged. All six pointer
tails bind concrete ObjectPtr<Entity>.Lock specification253210 through checked
metadata loads; it still has no invented concrete native mapping. Default Buff
owner instead reads m_container at+0x10 and the container's stored owner at+0x10,
without pointer locking. Field metadata binds Buff.m_source(+0x18), Ability.
m_owner(+0x48) and Projectile.m_source/m_traceTarget(+0xf0/+0x110).

`fearProjectileActionTargetGetters` implements these default field paths. Its
pointer getters pass a live view of the containing struct field to Lock, so
updates during lock callbacks are visible to later obj/cachedUid reads. They
do not make a detached pointer copy. The container owner remains a direct
nullable reference. Getter hotfixes and class initialization remain unverified.

Tests compose the getters with the reviewed Context ObjectPtr lock logic for
valid, recycled-UID and destroyed objects, and test pointer-field replacement
during Lock plus nullable/missing containers. The checked self-death graph now
uses these buff source/owner getters in both buff dispatch and target selection.
Concrete runtime generic dispatch, native Unity/UID interfaces and full live
controller/stage/frame parity remain open. Source/support/receipt/catalogue
gates are unchanged; this checkpoint stays local outside pending upload scope.

All1216 focused native/fear/family/miner tests and evidence reproduction pass.

### Reviewed target-selector switch and embedded jump table

The203 ordinary methods remain unchanged. The complete GetActionTarget PE
unwind region0xced380..0xced5c0 contains532 code bytes followed by eleven
little-endian RVA entries. A separately reviewed segmented record retains the
entire576-byte region, both portions and their hashes. Every table target is
a decoded instruction boundary, the unsigned selector check admits0..10,
and the dispatch reads the table at0xced594 relative to image base. The shared
linear code reader is unchanged; its earlier failure record and existing gates
remain intact. This adds source evidence without certifying runtime effects.

`fearProjectileActionTargets` implements all eleven selector branches. Target,
source and main target return their stored references directly. Buff source/
owner and main-buff source use a captured nullable buff receiver. Modifier
source/target delegate through the stored Modifier value. Projectile source/
trace target and ability owner first test Unity validity, then reread the
snapshot field before the getter; a field cleared after a successful validity
probe throws at that reread. Unknown selectors return null before snapshot
access. Owner/pointer getters and Unity validity remain explicit receivers.

The checked self-death graph now uses this selector's BUFF_OWNER branch in its
predicate calls. Tests cover all eleven cases, raw-reference retention, nullable
buffs, receiver capture, mutable snapshot rereads, invalid Unity objects and
post-validity null failures. All1212 focused native/fear/family/miner tests pass.
Class initialization, concrete pointer/owner/Unity effects and live controller/
stage/frame parity remain unverified. No source/support/receipt/catalogue gate
changes or stage promotion follow; this checkpoint remains local outside
pending upload authorization.

### Abnormal predicate nodes through ActionUtil

The203 ordinary bodies remain unchanged. New bindings retain instance fields,
ActionTargetType/AbnormalFlag/AbnormalCombo enum values and the exact call/read
sites for CheckAbnormalFlag, CheckAbnormalCombo and AlwaysNext. Target selection
resolves to Nodes.GetActionTarget, definition84019 at0xced380. Its shared strict
reader rejects complete chunk disassembly, so no body is retained or certified;
the producer pins that rejection and leaves its selection gate false. The
shared reader is unchanged.

`fearProjectilePredicateNodes` selects the entity and checks Unity validity
before inversion or attribute queries. Invalid entities return false even when
_isUnset is true. The flag path uses its literal enum for null/empty keys;
nonempty keys require blackboard access, capture the fallback flag, reread the
key and pass the native true argument to the explicit Int32 reader. It samples
inversion after blackboard effects and before the attributes getter. The combo
path also captures inversion before attributes, but reads its combo enum after
that getter. Both XOR the Boolean query result with captured inversion.
AlwaysNext's default Execute returns true without dereferencing its inputs.

Tests cover these read orders, whitespace keys, failed/null receivers and query
errors. A composed action test consumes the retained eight-node self-death
template and metadata enum mappings through ActionUtil, complete context copies,
managed stacks and guard disposal. Native attribute flag counters are used for
the three literal flag checks. Each LEVITATE/FROZEN/STUNNED/SLEEPING condition
stops the chain at its matching predicate; the clear path reaches mode/immunity/
kill receivers even when immunity creation returns false, through AlwaysNext.
Entity selection, combo/blackboard/Unity internals, virtual class dispatch and
the three downstream action effects remain explicit receivers. These tests do
not certify a live controller or stage. Source/support/receipt/catalogue gates
are unchanged; new stages remain test-only and this checkpoint stays local
outside pending upload authorization.

All1208 focused native/fear/family/miner tests pass for this predicate checkpoint.

### ActionUtil execution and FROM_BUFF source correction

The203 ordinary methods remain unchanged. New bindings retain ActionUtil's
three signatures, SourceType/ExecuteCondition enum constants, and ActionNode
virtual slots4/5/6 for allowed source, condition and Execute. The four-argument
RunActions snapshot parameter has exact type bits0x20110000 (by-reference bit29)
and Snapshot type8956. The concrete ActionNode IsNullOrEmpty specification258790
shares Object canonical208287 at0x3f62450; its complete body checks null or
count==0. The concrete specification still has no invented native mapping.

This review corrects the earlier Boolean/instant interpretation at Buff's
call0x39b5599: the input is SourceType.FROM_BUFF, integer1. The source pin is
renamed from instantTrueRva to fromBuffSourceTypeRva at the same instruction;
the retained bytes and earlier ordinary bodies are unchanged. The buff adapter
and its callback tests now pass and require the integer enum value.

`fearProjectileActionUtil` implements default CheckExecute and both RunActions
overloads. It checks the full requested source mask, resamples allowed source
for mismatch diagnostics, and applies ALWAYS/PREVIOUS_SUCCEED/PREVIOUS_FAILED
conditions. An unmet or unknown condition stops execution; ALWAYS can execute
after a failed node and restore success. Collection counts are reread after
effects, and node execution receives blackboard, SourceType and a by-reference
snapshot receiver. Nested calls retain independent local snapshot receivers.
The value-returning overload reads battle/context and copies a snapshot before
entering the collection, even when actions are null/empty. It returns a copy of
the final snapshot, including changes made before a false loop result.

Tests compose this utility with complete context field copies, managed stacks,
resize/fast-copy, buff source/owner targeting and guard disposal. Failed actions
followed by ALWAYS recover in order; thrown actions unwind; synchronous action
execution finishes before outer lifecycle cancellation restores all guard
frames. Native battle lookup, class initialization/hotfixes, virtual/collection
dispatch, diagnostics and concrete action-node effects remain explicit and
unverified for live controller/stage integration. All1197 focused native/fear/
family/miner tests pass. No source/support/receipt/catalogue gate changes or
stage promotion follow; this checkpoint remains local outside pending upload
authorization.

### Complete Modifier and AttackInfo field projections

The203 ordinary methods and earlier byte evidence remain unchanged. A new
layout record retains all20 instance fields of Torappu.Battle.Modifier and all
five AttackInfo fields, excluding static constants and hotfix delegates.
Their boxed metadata offsets are related to the136/40-byte native stack copies
by the16-byte object header. Closed generic field records bind both Modifier
pointers to ObjectPtr<Entity> and customKeys to List<String>. All ten enum
underlying fields are signed Int32; Torappu.FP's sole instance field is the
signed Int64 _serializedValue. No uninflated generic field offsets are used
to invent ObjectPtr storage layout.

`fearProjectileContextStructValues` provides complete field copies and fresh
zero defaults. Modifier copies detach both pointer records while preserving
their object references and UInt32 cached UIDs, retain the custom-key list
reference, and copy every raw FP, Boolean, mask and enum field. AttackInfo
copies all five fields. Raw FP values remain signed64-bit BigInts; arbitrary
Int32 enum bit patterns are preserved without domain normalization. Empty
values are zero-initialized structs, including atkScale=0, rather than constructor
results or Modifier.EMPTY. Extra JavaScript properties are outside the layout.

The ten-stack action fixture now uses these complete field projections through
snapshots, managed stacks, resize, fast-copy and guard disposal. Returned values
retain pre-disposal FP/pointer fields even after frame mutation, while custom-key
list identity remains shared. Tests also cover fresh zero records, independent
pointer copies, signed extremes, unknown enums, missing fields and lossy numeric
inputs. Native padding/noncanonical Boolean bytes, pointer addresses, GC state,
full runtime integration and controller/stage/frame parity remain unverified.
No source/support/receipt/catalogue gate changes or stage promotion follow;
this checkpoint stays local outside pending upload authorization.

All1188 focused native/fear/family/miner tests pass for this field-layout checkpoint.

### Native Array.FastCopy control flow

The203 ordinary methods and earlier fast-copy body remain unchanged. Six
separately bounded, exact-byte leaves/thunks bind array length(+0x18), the
class typeBits sign bit(+0x28), flags132 bit2, unboxed payload(+0x10), and the
element-size thunk/field(+0x100). Each has reviewed terminal instructions and
following INT3 padding; the shared strict reader is unchanged. The complete
subclass probe at0x428a40 is retained separately. Array class rank/element and
bounds/data offsets remain tied to the retained native fast-copy instructions.

`fearProjectileNativeArrayFastCopy` follows the flat-array rank/bounds checks,
destination-then-source unsigned range checks, and fresh element-class reads.
Equal element classes use element-scaled byte movement followed by a write
notification, including zero-length copies. Different reference classes check
destination/source ancestry in native order; the downcast path validates every
nonnull source object before copying. TypeBits-sign/flags-bit2 mismatches reject
the fast path. Boxed-object to value-type copies first validate all nonnull
objects, then zero the destination range and reread/unbox/copy each element.
A null box in that second pass preserves zeroing and any earlier element writes.

The helper uses explicit class records, subclass/cast receivers and byte-memory
operations, with signed Int32 element sizes and exact64-bit byte arithmetic.
Native cast/subclass internals, memory/GC effects, exception construction and
full Array.Copy fallback semantics remain unverified. Projected TypeErrors are
not claims about native exception classes. The ten-stack nested action fixture
now uses this control flow for8/16/136/40-byte elements while retaining typed
memory/default/copy fixtures. Tests cover flat/range rejection, overlapping
movement, ancestry direction, failed prescans, boxed conversion order and
partial failures. No source/support/receipt/catalogue gate changes or stage
promotion follow; this checkpoint remains local outside pending upload scope.

All1182 focused native/fear/family/miner tests pass for this control-flow checkpoint.

### Managed Array.Copy entry guards and fast-path dispatch

The203-method ordinary bundle adds the complete five-parameter mscorlib
Array.Copy body at0x51ce8a0. Its native fast-copy callee at0x4892f0 is retained
separately with complete PE unwind bounds. A reviewed11-byte native rank leaf
loads the array's class and its unsigned rank byte at+0x12e, then returns;
five following INT3 bytes delimit this no-stack-change leaf. The shared strict
reader remains unchanged. Earlier ordinary methods and evidence stay intact.

`fearProjectileManagedArrayCopy` implements entry validation and dispatch:
source null, destination null, negative length, source rank, destination rank,
rank mismatch, negative source index, negative destination index, then the
five-argument fast-copy call. A true result returns directly; false enters the
explicit native fallback receiver with the original arguments. Both paths keep
partial effects on exceptions. Full fallback bounds, lower-bound adjustment,
type conversion and exception translation are not replaced by a JavaScript
array loop. Native fast-copy effects and runtime array layout remain unverified.

The composed context fixture now passes resize copies through these guards and
dispatch. Six nested guards force all ten stacks through growth and saved-frame
copy before unwinding back to their originals. Other tests cover failure order,
rank/index precedence, selected fast/fallback dispatch and partial destination
effects. Native class initialization/allocation, fast-copy effects, typed value
defaults/copies and live controller/stage integration remain open. No source/
support/receipt/catalogue gate changes or new stage admission follow, and this
checkpoint stays local outside the pending upload authorization.

All1174 focused native/fear/family/miner tests pass for this entry checkpoint.

### Managed Array.Resize wrapper and publication ordering

Four additional complete canonical Array.Resize<T> specifications retain
the reference, Modifier, AttackInfo and ObjectPtr<Object> wrappers. Stack's
mscorlib type-token RGCTX range1444/8 binds slot7 to Resize definition216298
with generic method instantiation5331. The pointer specialization separately
uses the previously checked nested method argument12499. Array.Copy's direct
target0x51ce8a0 resolves through mscorlib's own table to definition216439,
with five parameters: sourceArray/sourceIndex/destinationArray/destinationIndex/
length. Its method-info argument is separate from those parameters. Copy body
effects and concrete RGCTX execution are not certified by this binding.

`fearProjectileManagedArrayResize` checks signed Int32 size before dereferencing
the byref array field, rejects negative sizes, allocates directly for null
storage, and preserves the original array when lengths already match. On changed
length it captures the old array, allocates a replacement, samples the old length
after allocation, copies min(oldLength,newSize) elements from index0 to index0,
and publishes the replacement only after copying succeeds. Allocation includes
the selected class-initialization receiver; native allocation and Array.Copy
remain explicit. The202 ordinary methods and all earlier records are unchanged.

Tests cover null/equal-size paths, growth/shrinkage, invalid sizes, source capture
and length-read order, allocation/copy exceptions and retry. All ten context
stacks in the composed action/guard tests now use this resize wrapper with
separate typed allocation/copy fixtures. Full native copy/default/allocation/GC
effects and controller/stage integration remain open. Source/support/receipt/
catalogue gates remain unchanged and all new stages remain test-only. This
checkpoint remains local outside pending upload authorization.

All1168 focused native/fear/family/miner tests pass for this wrapper checkpoint.

### Managed ObjectPtr stack storage and composed action guards

Four additional canonical specifications retain complete Stack<ObjectPtr<Object>>
Peek, Pop, Push and PushWithResize bodies. A selected nested-signature decoder
checks class instantiation12499, ObjectPtr definition1324 as a value type, and
System.Object definition37078 as the reference argument. The direct-type reader
is unchanged; the selected type records are retained as raw hex alongside the
native mappings. The202 ordinary methods and all earlier evidence are unchanged.

`fearProjectileManagedPointerStacks` supplies16-byte pointer-value storage
through the selected managed value-stack implementation. Push copies pointer
fields before resize; Pop increments version and reduces count, saves the
pointer value, clears the original slot to null object/zero UID, then returns
a separate copy. Pointer locks still validate saved UIDs against live objects.
The canonical signature does not certify concrete runtime RGCTX dispatch.

Action dispatch tests now compose all ten context fields with managed storage:
six pointer stacks, two class-reference stacks, Modifier and AttackInfo stacks.
Snapshot capture, frame duplication, four setters and guard disposal run through
those receivers. Normal, thrown, cancelled and nested actions restore outer
frames; stale UID locks return null without changing stored identity; repeated
empty disposal leaves versions unchanged. Clearing assertions distinguish
pointer/reference/Modifier slots from retained AttackInfo bytes. Copy/default
receivers and Array.Resize allocation remain explicit, and GC barriers and live
controller/stage integration remain unverified. All1163 focused native/fear/
family/miner tests pass. Source/support/receipt/catalogue gates remain unchanged;
new stages remain test-only. This checkpoint stays local outside pending upload
authorization.

### Managed Modifier and AttackInfo stack storage

The202 ordinary methods remain unchanged. Eight additional canonical
Stack<Modifier>/Stack<AttackInfo> specifications retain complete Peek, Pop,
Push and PushWithResize bodies. Modifier Peek's selected array-copy helper
at0x1d5270 is retained separately, with complete bounds checking and136-byte
copy instructions. The two stack element widths are136 and40 bytes.

`fearProjectileManagedValueStacks` keeps those specializations distinct.
Modifier Pop increments version and reduces size, copies the captured slot
to a temporary, clears that slot, then copies the temporary for return.
AttackInfo Pop updates version/size and copies40 bytes without clearing the
captured slot. Both Push paths copy the input to a temporary before entering
PushWithResize. Direct PushWithResize reloads array and size after the explicit
byref allocation caller and then copies the supplied value into the destination.
Fitting Push retains its captured count for the size write; resize increments
the current count. Typed copies/defaults remain explicit receivers, preserving
embedded Modifier references rather than recursively cloning referenced objects.

Tests cover detached value bytes, selected clearing rules, embedded reference
identity, pre-resize argument capture, direct resize input timing, replacement
storage/count, version wrap, failures at copy/allocation/return, and composition
with Context snapshot duplication. All1156 focused native/fear/family/miner
tests pass. Complete typed-copy/default semantics, native allocation/GC,
ObjectPtr specialization and live controller/stage integration remain open.
No source/support/receipt/catalogue gate changes or stage promotion follow.
This checkpoint remains local outside the pending upload scope.

### Managed reference stack storage

The202 ordinary methods remain unchanged. Four additional canonical
Stack<Object> specifications retain complete Peek, Pop, Push and PushWithResize
bodies. Native instructions establish array/size/version offsets16/24/28;
uninflated generic metadata offsets are not used as inflated layout proof.

`fearProjectileManagedReferenceStacks` supplies reference storage to the
existing value-context helpers. Empty Peek/Pop throws at this lower layer,
while the context wrapper still returns null before entering it. Pop increments
the signed Int32 version and reduces size before reading the captured array,
then clears the popped reference. Push uses captured size on the fitting path;
resize requests capacity4 from zero or doubled Int32 capacity, then reloads
both array and size after the explicit byref Array.Resize caller. It preserves
partial allocation failures and performs unsigned bounds checks.

Tests cover growth across three capacities, identity retention, reference
clearing, version wrap, changed storage after resize, failed allocation,
invalid counts, Pop ordering and context empty/default composition. All1146
focused native/fear/family/miner tests pass. Native Array.Resize allocation,
GC barriers, pointer/value-struct specializations and live controller/stage
integration remain unverified; source/support/receipt/catalogue gates are
unchanged. This checkpoint remains local outside the pending upload scope.

### Context pointer/value stack operations

The202-method ordinary bundle now also retains thirteen mapped canonical
ContextPtrStack/ContextValueStack specifications for Object, Modifier and
AttackInfo. The reference get_value thunk is a separately reviewed22-byte
read-only RGCTX tail dispatch with ten following INT3 bytes; the shared strict
unwind reader is unchanged. Type-token RGCTX ranges bind slot2 to Peek for
both classes, plus ObjectPtr.Wrap/Lock and underlying Stack count/Push/Pop/Peek
definitions. Closed concrete generic execution and storage remain unverified.

`fearProjectileContextPointerStacks` checks count before Peek/Pop, returning
null for nonpositive counts. Positive operations copy the stored pointer and
lock that copy; Pop removes storage before locking. Push wraps the input before
checking a null stack receiver, then copies the pointer before storing it.
`fearProjectileContextValueStacks` likewise checks counts but returns supplied
typed defaults when empty and copies supplied value results when nonempty.
Reference-valued frames keep class references directly, without pointer UID/
Unity validation. Both getValue paths delegate to their Peek operation.

Tests cover empty/default behavior, stale/recycled/destroyed pointers, wrap/
receiver/copy ordering, failures after Pop removal, changed storage after count,
and reference-vs-value semantics. A composed action dispatch now uses concrete
pointer locking and value-stack controls through duplication, guard setters,
snapshot capture and repeated disposal. The remaining array-storage and typed
default/copy fixture receivers are explicit; they do not certify native Stack
memory, concrete RGCTX dispatch or full Modifier value copies. All1141 focused
native/fear/family/miner tests pass; --check reproduces the complete artifact,
including the202 ordinary methods and these canonical generic records.

Hosted full40558578137 at approved0524e2b1 passed; continuation40558189633
passed on attempt2. Upload approval through14d116d2 remains pending and this
newer checkpoint stays local. Underlying native stack/storage and value-copy
effects, ActionUtil execution and full controller/stage/frame integration
remain open. Source/support/receipt/catalogue gates remain unchanged and all
new stages remain test-only.

### Context snapshot capture and frame duplication

The202-method bundle adds complete Context.TakeSnapshot and _DuplicateAll.
The contextSnapshots record binds all twenty closed stack getter/Push
specifications, field loads and calls. Capture reads source, target, buff,
ability, modifier, projectile, tile, attack info, main target and main buff.
Duplication pushes main target before attack info instead. Reference-valued
Ability/Entity frames use the underlying Stack Push; Modifier/AttackInfo use
their value-specialized Push bodies. Native storage/copy effects remain open.

`fearProjectileContextSnapshots` captures those ten fields in native order,
copying Modifier and AttackInfo immediately after their stack reads. Snapshot
copying preserves the eight reference identities and delegates the two nested
value copies. Duplication captures once before any Push, copies the result,
then reads each current destination stack before copying that Push's argument.
It preserves partial pushes on failure. These synchronous context operations
finish once entered so outer guard cleanup can restore a completed frame after
lifecycle cancellation; they do not add cancellation inside a native stack call.

Tests cover distinct capture/push ordering, immediate value copies, preserved
reference identities, changed destination stacks, captured Push receivers,
null reference values, missing stack storage and partial Push failures. Buff
dispatch now composes concrete duplication, guard controls, snapshot capture
and return-copy ordering around restoration, with explicit native stack/value
receivers. The fixture adapters do not certify native pointer locking or nested
value-copy behavior. All1130 focused native/fear/family/miner tests pass;
--check reproduces202 complete methods. This checkpoint remains local.

Hosted full40558578137 at approved0524e2b1 passed; continuation40558189633
passed on attempt2. Approval to upload the accumulated checkpoints through
14d116d2 is pending; this newer snapshot checkpoint is outside that upload.
Native context stack/value effects, action-array execution and full controller/
stage/frame integration remain open. Source/support/receipt/catalogue gates
remain unchanged and all new stages remain test-only.

### Context guard initialization, replacement and disposal

The200-method bundle now binds ChangeGuard.m_context, all ten Context stack
fields, the exact ChangeGuard allocation type and eighteen closed stack
specifications. Setters use ContextPtrStack Pop/Push. Disposal distinguishes
pointer stacks from ContextValueStack<Ability/Modifier/Entity/AttackInfo>.
BeginChangeGard assigns the context and invokes Context._DuplicateAll; it does
not store an old-context object inside the guard. The latter method's body and
generic stack effects remain outside this checkpoint's execution claim.

`fearProjectileContextGuards` allocates and initializes the guard, writes its
context, then invokes duplication. Buff/source/target/tile setters Pop one
pointer stack, reread guard.m_context, and Push on the current stack. Dispose
captures its context once and Pops source, target, buff, ability, modifier,
projectile, tile, main target, attack info and main buff in native order. It
does not clear m_context or add an idempotence flag. Errors retain completed
Pops. Begin/set operations check lifecycle before entering and finish their
native stack changes once entered. Dispose remains callable after cancellation,
so the outer action dispatch's finally can clean up a returned guard.

Tests cover allocation/initialization/duplication order, all four setters,
context replacement between Pop/Push, captured disposal contexts, repeated
disposal, null/receiver failures and partial stack changes. Action dispatch
composes concrete guard controls with explicit stack/duplication receivers;
cancellation during setter or duplication still restores balanced fixture
frames through outer finally cleanup. The array-backed fixture receivers do
not certify native stack storage, pointer UID locking, value copying or
_DuplicateAll execution. All1120 focused native/fear/family/miner tests pass;
--check reproduces200 methods. This checkpoint is local.

Hosted full40558578137 at approved0524e2b1 passed, as did continuation40558189633
on attempt2. These validate that approved remote commit; the newer local
checkpoints still require hosted validation. Native guard allocation/stack/
duplication effects, ActionUtil execution, value copies and full controller/
stage/frame integration remain open. Source/support/receipt/catalogue gates
remain unchanged and all new stages remain test-only.

### Buff event action dispatch and context-guard lifetime

The200-method bundle adds Buff._RunActions/context/source getters and complete
Context.BeginChangeGard plus ChangeGuard buff/source/target/tile setters and
Dispose. Caller metadata binds Entity.get_alive slot38, get_rootTile slot50,
System.IDisposable.Dispose slot0, event-action/blackboard fields and the240-byte
Context.Snapshot return layout. The result includes reference fields and nested
Modifier/AttackInfo values; native value-copy semantics remain an explicit
receiver rather than treating the result as a flat reference object.

`fearProjectileRunBuffActions` obtains a context guard, sets buff/source,
optionally sets the owner target, then reads a fresh owner for alive status.
Living owners cause another owner read and root-tile assignment. It captures
the event action array, checks bounds, reads blackboard and runs the selected
array with SourceType.FROM_BUFF(1), including null action entries. A value-copy receiver
captures the result before guard disposal and copies it again on return.
All errors/cancellations after a guard is returned dispose that guard; a null
or throwing creation has no fabricated disposal. Nested invocations retain
independent guard and result state.

Tests cover exact configuration/copy/disposal order, distinct owner samples,
dead-owner tile preservation, optional targeting, null action slots, invalid
arrays/events, each receiver-failure phase, cancelled creation/disposal and
nested calls. Enable/disable events compose this concrete dispatcher. Fixture
guard/action/snapshot receivers test ordering without certifying native guard
pooling/restoration, action-array execution or mixed-value copying. All1106
focused native/fear/family/miner tests pass; --check reproduces200 methods.
This checkpoint is local. Approved0524e2b1 continuation passed on attempt2;
original full40558578137 remains active.

Concrete guard effects, ActionUtil array execution, Snapshot value copies,
native provider/set/conversion/range effects, effect refresh and full controller/
stage/frame integration remain open. Source/support/receipt/catalogue gates
remain unchanged and all new stages remain test-only.

### Concrete buff attribute provider and load-to-evaluation composition

The191-method bundle adds complete Buff.GetValue evidence, reusing the retained
get_isEnabled body. The buffAttributeProvider record binds actual-enable at
0x1ec, all four modifier-array offsets, ordered output writes, return branches
and the original1.0 neutral-scaler constant. The default getter reads actual
enable directly; no manual/late/finished or attribute-mask condition is added.
Native interface/hotfix dispatch remains explicitly unverified.

`fearProjectileBuffAttributeProvider` returns the selected addition, multiplier,
final addition and final scaler from separate fresh array reads when enabled.
It retains earlier output writes on later bounds/null failures. Disabled buffs
write finalAddition0, multiplier0, addition0, finalScaler1 in native order and
return false without reading arrays. Invalid enum bounds are therefore not
checked by this disabled branch. The existing provider out storage is reused.
Actual enable is sampled once; reentrant writes and lifecycle cancellation
retain native partial ordering.

Tests cover actual-vs-manual/finished behavior, neutral output order, live array
replacement after output writes, partial failures, null output precedence,
getter sampling, cancellation and nested calls. A composed loaded buff now runs
concrete attribute loading, enable/disable, modifier registration/removal,
dirty marking, provider reads and evaluation: an addition raises the base stat
from100 to102 and disabling restores100. The fixture's set/encryption adapters
do not certify native HashSet equality or obscured conversion.
All1087 focused native/fear/family/miner tests pass; --check reproduces191
methods. This checkpoint is local. Approved0524e2b1 continuation passed on
attempt2; original full40558578137 remains active.

Native interface/hotfix dispatch, HashSet iteration/equality, obscured values,
range storage, actions, effect refresh, snapshot consumption and full controller/
stage/frame integration remain open. Source/support/receipt/catalogue gates
remain unchanged and all new stages remain test-only.

### Native attribute evaluation and cached reads

The190-method bundle adds Attributes._CalculateAttributeValue. Exact metadata
loads bind HashSet<IAttributesModifier> enumeration and closed
IAttributesDataProvider<AttributeType>.GetValue slot0 with four output parameters:
addition, multiplier, finalAddition and finalScaler. The two original float
constants are1.0. Caller anchors bind signed dirty checks, disposal paths,
dirty clearing, formula operations, independent range-override reads, clamp,
cache capture and40-byte encoded writes. The complete clamp body applies the
upper limit before the lower limit, including inverted ranges.

`fearProjectileAttributeValues` implements cached GetValue, calculation and
GetValueRoundToInt. Clean reads copy the cached obscured value before decoding.
Only a signed-positive dirty-bit test selects calculation; bit63 retains native
signed behavior. Calculation initializes addition/finalAddition0 and
multiplier/finalScaler1, enumerates providers with shared output storage, and
accumulates only true results. False calls can still change output storage seen
by later calls. It disposes enumeration, clears the current dirty bit, then
computes ((base+addition)*max(0,multiplier)+finalAddition)*finalScaler with native
signed FP arithmetic. Lower and upper bounds each read current override/default
range projections. Cache storage is captured before encoding and checked after
that call; encoded bytes are copied into the captured array. RoundToInt uses
the retained native ties-to-even conversion.

Tests cover all four accumulators, false-result output reuse, negative
multipliers, overrides/inverted ranges, signed bit63, clean-copy/rounded reads,
disposal, failures before/after dirty clearing, nested dirty changes, cache
replacement during encoding and lifecycle cancellation. Runtime snapshots now
compose concrete evaluation/cached reads and rounded integer attributes.
All1079 focused native/fear/family/miner tests pass; --check reproduces190
complete methods. This checkpoint is local. Approved0524e2b1's continuation
passed on attempt2; original full40558578137 remains active.

Concrete buff provider dispatch, native HashSet iteration/equality, obscured
conversion/decryption, native range storage, actions, effect refresh, full
snapshot consumption and controller/stage/frame integration remain open.
Source/support/receipt/catalogue gates remain unchanged and all new stages
remain test-only.

### Native source-stat snapshot copies

The189-method bundle adds RuntimeAttributesSnapshot.TakeSnapshot,
Attributes.GetValue/GetValueRoundToInt and the exact cross-image FP/int
obscured-value conversion bodies called by capture. Metadata binds the nine
snapshot fields and their boxed offsets; original stores copy their unboxed
40-byte FP and20-byte integer representations. The source-lock usage binds
ObjectPtr<Entity>.Lock; source Unity validity and Entity.get_attributes precede
the runtime snapshot call. Native obscured-value conversion and concrete pointer
dispatch effects remain explicit and unverified by this caller evidence.

`fearProjectileRuntimeSnapshot` reads maxHP, ATK, DEF, resistance, cost, block,
attack speed, base attack time and respawn time in native order at attribute
indices0/1/2/3/4/5/7/8/21. Cost/block/respawn use native integer reads; the others
use signed FP reads. Each encoded value is copied into its own field before
reading the next attribute. Converted byte buffers cannot alias snapshot fields.
Failures retain earlier field writes and leave later old fields intact.

`fearProjectileTakeBuffSnapshot` locks the current source pointer once, checks
Unity validity, obtains source attributes, then reads the current destination
snapshot. Invalid/destroyed/stale-UID sources retain prior snapshot contents;
there is no invented clearing. Tests compose concrete context-pointer validity,
runtime capture and EXTEND's snapshot-before-blackboard-copy ordering. They also
cover reused Buffer conversions, getter effects replacing destination storage,
null attributes, malformed conversion widths, partial failures and cancellation.
All1067 focused native/fear/family/miner tests pass; --check reproduces189
methods. This checkpoint is local; original full40558578137 remains active
at approved0524e2b1, whose continuation passed on attempt2.

Native attribute evaluation and obscured-value conversion, HashSet equality,
actions, OnBuffExtend/effect refresh, full snapshot consumption and controller/
stage/frame integration remain open. The owner-extension trace primarily routes
effect-key refresh; stat snapshots were completed first to preserve mechanics
priority. Source/support/receipt/catalogue gates are unchanged and all new
stages remain test-only.

### Attribute dirty bits and cached-value callback copies

The184-method bundle additionally retains Attributes.MarkAttributeDirty and
the exact Torappu.Common.dll ObscuredFP.op_Implicit wrapper called by it.
Metadata binds m_cachedData to an ObscuredFP array, m_dirtyMask to signed Int64
and onAttributeMarkedDirty to its native delegate field. Caller instructions
bind two identity conversions, low-six-bit dirty selection, the40-byte cache
stride and16+16+8-byte stack copy before conversion. The native decryption and
delegate effects remain explicit; the retained wrapper alone does not certify
their execution.

`fearProjectileMarkAttributeDirty` captures the old dirty mask and delegate,
writes the selected bit, and skips cache access when no delegate exists. With
a delegate it checks the original signed attribute index against the cache,
copies all40 cache bytes, converts that copy and invokes the captured delegate
with index/value. The array index is not reduced to six bits. Invalid indices
therefore retain their dirty-bit write before throwing. Copies also detach
Buffer-backed byte views; callback replacement during conversion does not
replace the already captured delegate. Nested calls and completed mutations
survive receiver failure or lifecycle cancellation according to call order.

Tests cover copy detachment, captured callbacks, missing delegates, wrapped
dirty indices with unmasked bounds checks, nested callbacks, conversion failure,
cancellation and composition after all selected per-attribute set mutations.
All1058 focused native/fear/family/miner tests pass; --check reproduces184
complete methods. This checkpoint remains local. Approved0524e2b1 continuation
passed on attempt2; original full40558578137 still has eight live Linux/Windows
test jobs across Node22/24 and both shards.

Cached-value conversion/decryption, native delegates, HashSet equality/storage,
actions, snapshots, OnBuffExtend and full controller/stage/frame integration
remain open. Source/support/receipt/catalogue gates remain unchanged and all
new stages remain test-only.

### Abnormal combo counters and dirty notification passes

The182-method bundle adds complete AbnormalComboManager.PushMask/PopMask,
_UpdateAbnormalCombo and static constructor bodies, plus
Attributes._CalculateAbnormalDirtyByModifier. The comboMutation record binds
signed Int16 counter-array elements, signed Int64 combo/flag masks and the
two-entry signed mapping array. Original constructor writes bind exact flag
masks0x80028 and0x40028. The abnormalDirty record binds flag/combo delegate
fields, four interface slots, enum identity conversions, loop bounds and calls.

`fearProjectileBuffCombos` updates only the native two combo entries, wrapping
counter changes as signed16 bits. A combo is active when its counter is positive
and its immunity counter is nonpositive; the latter array is not read when
the active counter is nonpositive. Each affected entry is recalculated even
after an earlier entry changed. Derived abnormal flags are rebuilt only if
some combo enabled bit changes. The rebuild captures the combo mask once and
rereads the mapping array for each active entry. Unchanged state retains the
existing derived mask. Signed masks, unrelated stored combo bits and partial
failure/cancellation mutations are preserved.

`fearProjectileAbnormalDirty` reads flag, combo, immune and combo-immune masks
in separate passes, with44/2/44/2 entries. Each pass captures its own mask but
reads the current nullable delegate for every matching bit; later passes see
earlier callback effects. The anti mask does not add a fifth notification pass.
Actual native delegate invocation remains an explicit receiver.

Tests cover combo projection/immunity, unchanged masks, both-entry updates,
ignored high bits, Int16 overflow, short/null arrays, captured masks and live
mapping arrays, nested calls, partial failures and lifecycle cancellation.
Modifier and enable/disable composition now use concrete combo mutations and
native flag queries. Dirty callbacks observe the updated counters/combo flags;
separate mask passes and callback replacement are covered. All1050 focused
native/fear/family/miner tests pass; --check reproduces182 methods. This is a
local checkpoint; approved0524e2b1 continuation passed on attempt2 and original
full40558578137 remains active.

Native static-mapping lifecycle, delegate execution, attribute-value dirty
propagation, HashSet equality/storage, actions, snapshots, OnBuffExtend and full
controller/stage/frame integration remain open. Source/support/receipt/catalogue
gates are unchanged and all new stages remain test-only.

### Attribute modifier registration and removal

The177-method source bundle now also binds AddModifier/RemoveModifier's exact
HashSet<IAttributesModifier> Add/Remove specifications, all twelve interface
type loads and six interface getter slots. Concrete generic mappings remain
null. Field metadata binds the overall abnormal-modifier set, per-attribute
sets, three signed Int16 counter arrays and combo manager. Caller anchors bind
the44-flag and38-attribute loops, separate dirty pass, PushMask/PopMask and
_CalculateAbnormalDirtyByModifier tail. These do not certify set equality,
combo mutation or dirty propagation effects.

`fearProjectileAttributeModifiers` performs the overall set operation before
checking a null modifier. Only changed abnormal membership loads immune,
anti and flag masks and updates the44 counter entries, in flag/immune/anti
order per index, wrapping signed16 bits. It captures the combo manager before
loading combo and combo-immune masks. Regardless of membership change, it then
loads the current attribute mask, updates each selected per-attribute set,
marks affected attributes dirty in a separate pass, and calculates abnormal
dirty state. Duplicate adds and missing removes therefore retain the native
per-attribute/dirty effects. Removal reads live masks; it does not invent a
snapshot of the original registration. Reentrant calls remain independent.

Tests cover changed/unchanged membership, both loop boundaries, mask/getter
ordering, captured combo receivers, live per-attribute arrays, changed removal
masks, signed counter overflow, partial null/bounds failures, nested registration,
callback failure and lifecycle cancellation. Concrete enable/disable composition
now updates counters observed by native abnormal-status and anti queries.
All1031 focused native/fear/family/miner tests pass; --check reproduces the
177-method bundle. This checkpoint is local. Continuation40558189633 at
approved0524e2b1 passed on attempt2; full40558578137 remains active.

Native HashSet equality/storage, combo PushMask/PopMask recalculation, actual
dirty propagation, action execution, snapshots, OnBuffExtend and full controller/
stage/frame integration remain open. Source/support/receipt/catalogue gates are
unchanged and all new stages remain test-only.

### Buff manual, actual and late activation

The177-method bundle additionally retains _UpdateIsEnabledIfNotFinished,
Entity silence/stun/frozen getters and Attributes.AddModifier/RemoveModifier.
The enabledUpdate record binds all capability/lifecycle offsets, separate
manual/actual/late writes, owner/status/attribute calls and action dispatch.
The exact _RunActions parameter metadata identifies `ev` and `setMeAsTarget`.
Only the two selected single-byte Buff.Event constants are decoded here:
ON_BUFF_ENABLE24 and ON_BUFF_DISABLE25. Other Event constants remain outside
this record's claim; the shared enum decoder is unchanged.

`fearProjectileBuffEnabled` preserves the native setter's finished-and-true
bypass; false is still accepted after finish. It writes manual enable before
updating actual state. Update captures manual enable and one owner, then checks
silence, stun, frozen and levitation in that order using live capability fields
and separate owner-validity calls. A suppressing status stops later queries.
These checks still run when manual enable is false. A changed actual state is
written before modifier/action callbacks; enabling also writes late-enabled,
while disabling leaves late-enabled untouched. A fresh owner/attribute lookup
then adds/removes the modifier and runs the matching action event with
setMeAsTarget=true. Unchanged actual state performs neither mutation nor event.

Tests cover all four suppression branches, recovery, disabled capabilities,
captured manual/owner values, live capability changes, finished-buff disabling,
owner destruction/replacement, null lookup failure, retained late state,
nested modifier callbacks, receiver errors and lifecycle cancellation. NewBuff
direct activation and override-group finished-prefix replacement compose this
concrete setter. All1017 focused native/fear/family/miner tests pass and --check
reproduces177 methods. This checkpoint is local; approved0524e2b1 continuation
CI passed on attempt2 and its original full40558578137 is still active.

Native modifier storage, action execution, snapshot copying, OnBuffExtend
effects, full buff/controller/frame integration and remaining stage admission
remain open. All source/support/receipt/catalogue gates are unchanged and all
new stages remain test-only.

### Override-group duration merge and stack effects

The171-method bundle additionally retains default Buff.get_lifeTime,
get_remainingTime and get_existingTime, including their separate hotfix branches.
The mergeTiming record binds field offsets, exact getter samples and writes,
the existing signed FP addition/comparison/maximum evidence, and the owner
notification target Entity.OnBuffExtend. Getter hotfix effects and notification
execution remain explicit receivers and are not certified by caller evidence.

`fearProjectileMergeBuffTiming` implements the four default merge callees.
EXTEND tests the incoming lifetime, adds it to remaining and total lifetime
only if the first sample is nonnegative, and always adds incoming existing
time. It preserves three lifetime getter samples on the finite branch and
captures old total lifetime before the final sample. FILL samples lifetime
again after its sign test, writes either that negative-branch result or the
maximum of that result and current remaining duration, and adds existing time.
Both operations notify a valid owner through a second owner lookup after the
timing writes. STACK increments its signed Int32 count, takes the maximum of
captured old remaining duration and incoming remaining duration, then updates
attributes. Refresh at the stack maximum only performs that duration maximum.
FP addition wraps signed64 bits. Neither operation invents a notification or
changes total lifetime/existing time in the stack branches.

Tests cover negative/zero/finite lifetime, changing getter samples and fields,
signed overflow, null-input partial stack increments, owner replacement and
destruction, nested notification, lifecycle cancellation and receiver failure.
Override-group composition executes concrete EXTEND/FILL timing and STACK
timing plus capped attribute updating, then maximum-stack refresh without an
extra attribute update. All1000 focused native/fear/family/miner tests pass;
--check reproduces171 complete methods. This checkpoint is local.

Continuation40558189633 at approved0524e2b1 initially failed because Chrome
did not expose its debugging endpoint within30 seconds in the17-10 browser
job. Rerunning failed jobs on the same handle passed (attempt2). Full40558578137
remains active; it has not been restarted or replaced. Queue ordering, snapshot
effects, enable effects, actual OnBuffExtend behavior and full controller/stage
integration remain open. All source/support/receipt/catalogue gates are retained
and all new stages remain test-only.

### Override-group merge dispatch and live activation selection

The168-method bundle retains complete OverrideGroup._DoAddInternal and
_DoUpdateInternal bodies, plus Buff duration-extension/fill, snapshot, capped
refresh and stack-add callees. Exact metadata loads bind PriorityQueue<Buff>
isEmpty, indexer, Add and count specifications; their concrete native mappings
remain null. The snapshot-on-extend field is BuffData.takeSnapshotWhenExtend
at0x71. These records do not certify queue storage/comparison or callee effects.

`fearProjectileOverrideGroup` dispatches DEFAULT to enqueue, UNIQUE to enqueue
only when empty, EXTEND_TIME to extend the front duration, and EXTEND to fill
the front duration with optional snapshot then whole-pair blackboard assignment.
STACK admits the first buff with the group's valid-stack cap. Later additions
delegate stack addition below the maximum (or with a negative unlimited maximum),
refresh only exactly at the maximum with the refresh flag, and reject above it.
The count-plus-one comparison wraps as signed Int32 before testing the maximum.
Each native front lookup remains distinct across receiver effects.

Update enables the first unfinished queue member, disables finished prefixes
and every subsequent member, and skips later finished getters after selection.
It captures each count receiver but rereads the queue for the indexed item and
after each setter. Each nested call keeps a separate selection flag; no new
reentry suppression is introduced. Lifecycle cancellation and receiver failures
retain completed mutations. NewBuff composition exercises all five modes,
registration before merge, finish/remove on rejection, and activation only on
successful insertion. EXTEND also composes concrete whole-pair assignment.

All980 focused native/fear/family/miner tests pass. The source producer's --check
reproduces168 methods. This checkpoint and the preceding group-initialization
checkpoint remain local. Approved0524e2b1 is on the remote development branch;
full40558578137 and continuation40558189633 are still in progress at that SHA.
Older continuation40554907726 atb437ef5e and full40550025781 at93014b95 passed.

Native queue ordering, concrete duration/stack/enable effects, full activation
and live controller/stage/frame integration remain open. Source/support/receipt
gates are unchanged, and all new stages remain test-only.

### Override-group initialization and stack limits

The162-method bundle additionally retains Buff.get_blackboard and resolves the
EnsureOverrideGroup caller's exact PriorityQueue<Buff> count, constructor and
Clear specifications. Their concrete mappings remain null. Type metadata binds
new allocation to OverrideGroup, and original string literals bind
`max_stack_cnt` and `max_valid_stack_cnt` in both initialization branches.
OverrideType.STACK is1; DEFAULT/UNIQUE/EXTEND/EXTEND_TIME are0/2/3/4.

`fearProjectileEnsureOverrideGroup` preserves an existing group with a populated
queue without reading or replacing its configuration. An empty group rereads
the queue before clearing it or creating a replacement. A missing group is
constructed and given a new queue. Initialization copies overrideType, uses
GetIntOrDefault(key,configuredDefault,true) for the two STACK limits, and uses
maxStack1/maxValidStack-1 for other types. Each STACK lookup obtains blackboard
before rereading data. The second branch checks the group's current type after
the first lookup. New-group registration rereads the map before obtaining a
second override-key sample; existing groups are not registered again.

Tests cover populated-group preservation, empty/null queue reinitialization,
late queue/map/key changes, signed stack limits, missing groups and null values,
partial initialization/Add failures, lifecycle cancellation and reentry.
A NewBuff composition uses this implementation and concrete Blackboard readers
to obtain floor-rounded stack limits before invoking group insertion. All952
focused native/fear/family/miner tests pass, and --check reproduces162 methods.
This checkpoint is local; hosted validation remains pending.

Native queue/group construction and priority-queue storage/comparison, stack
merge/update effects, full activation and live enemy/controller/stage/frame
integration remain open. Source/support/receipt/catalogue gates are unchanged;
all new stages remain test-only.

### Native abnormal-status queries and NewBuff admission gates

The161-method artifact additionally retains Attributes.GetAbnormalFlag and
GetAbnormalAnti, Entity's raw-changeable-motion and levitation getters, and
AbnormalComboManager.GetAbnormalFlag. The three counter fields at0x20/0x28/0x30
are verified SZARRAYs of signed Int16 values. Anti queries test counter>0.
Flag queries use a positive active counter only when the immunity counter is
nonpositive; otherwise they fall through to the combo manager, rather than
unconditionally returning false for immunity.

The combo manager getter reads signed Int64 m_abnormalFlagMask at0x28, shifts
using the enum's low six bits, and applies TEST/SETG. Its bit63 result therefore
does not count as positive. `fearProjectileComboFlag` and
`fearProjectileAttributeStatus` implement these selected queries, with real
counter-array bounds and signed values. This binds querying the combo mask,
not the manager's complete update/combination lifecycle.

`fearProjectileBuffAdmission` now supplies the three retained default gates.
Abnormal anti treats null/empty incoming flags as pass; otherwise it rereads
the flags, enumerates in native order, obtains current owner attributes for each
flag, stops on the first positive anti query, and disposes on rejection,
exhaustion or error. Status resistance queries owner flag30 only when the buff
is status-resistable. Incoming LEVITATE25 requires an Enemy cast of the original
owner, a non-destroyed Unity object and raw MotionMode.WALK0. An already
levitating Enemy additionally requires incoming FORCE_LEVITATE36, using a fresh
flag-list read. FORCE_LEVITATE alone does not imply LEVITATE for this gate.

Tests cover signed counters, immunity/combo fallthrough, bit63/shift behavior,
array bounds, native enumeration errors/disposal, repeated owner reads,
non-enemies, destroyed owners, raw flying mode, repeat/forced levitation,
changed incoming lists and lifecycle invalidation. NewBuff tests use the concrete
queries/gates for rejection before allocation and for status rejection after
Reset. The pool/Reset/NewBuff composition also uses them, including real
counter-driven recycling without registration. All934 focused tests pass;
the161-method bundle reproduces with --check.

Continuation40554907726 atb437ef5e and full40550025781 at93014b95 both passed.
Native flag-list storage/version effects, combo-mask update lifecycle,
override-group/activation internals, cross-version/frame parity and live enemy/
controller/stage integration remain open. Source/support/receipt/catalogue gates
are unchanged; all new stages remain test-only.

### NewBuff registration and activation order

The156-method artifact additionally retains BuffContainer.NewBuff,
EnsureOverrideGroup, its three anti/levitate gates and pool/owner/attribute
getters, plus Buff's effect override, status-resistance/abnormal-anti getters,
enabled setter and Entity's attribute getter. Concrete generic specifications
bind Allocate/Recycle<Buff>, ObjectPtr<Buff>.op_Implicit and
Dictionary<UInt32,Buff>.Add without inventing concrete mappings. The independently
mapped Object canonical implicit-pointer body0x477cf00 is retained. A checksum
reference links the already retained Buff.OnStart/context evidence.

NewBuff cleans finished buffs before reading input.data. It applies abnormal
anti and levitation gates before source/target cancellation flags37 and38, then
allocates and snapshots the input BuffConfig for Reset. A nonempty custom effect
override, including whitespace, is applied after Reset. Status-resistance
rejection recycles immediately through a fresh pool getter and returns null
without list/UID registration. Other exceptions do not invent pool rollback.

On acceptance, the buff-list receiver is captured before pointer construction;
the UID-map receiver is captured before reading the new UID. List insertion and
UID registration both precede activation. It is the owner's BObject.inited
field at0x24 that gates OnStart. Next, the new buff's abnormalAntiMask is passed
to _FilterBuffAbnormalAnti; this is not its abnormalFlagMask. Finished state is
checked only afterward. A finished, started buff delegates finish/removal and
returns null; a finished but unstarted buff is returned without enabling or
override insertion. Empty override keys enable directly. Otherwise group queue
membership uses object identity, reading count/item receivers separately.
Rejected _DoAddInternal delegates finish/removal; success calls _DoUpdateInternal.

`fearProjectileNewBuff` implements that selected invocation order with explicit
native effects. Separate nested invocations in the same container are allowed
during activation; reuse of the same invocation cannot duplicate allocation.
The pool/Reset/pointer composition test verifies allocation UID, timing, status,
shield and priority before activation, plus immediate recycling on later status
rejection. Another test makes registration visible during the retained native
self-death action receiver and verifies that an action's false return is not
mistaken for NewBuff's receipt. Tests also cover early gates, custom effects,
late config snapshots, inited/started distinctions, post-filter finish checks,
queue identity/rereads, add rejection, partial registration failures, reentry,
nested registration and lifecycle cancellation. All904 focused tests pass;
the156-method source bundle reproduces with --check.

Continuation40553079851 at3beae344 passed. Full40550025781 at93014b95 is still
active and has not been replaced. Native anti/levitate effects, override-group
internals, complete activation effects and live enemy/controller/stage/frame
integration remain open. Existing source/support/receipt/catalogue gates are
unchanged; all new stages remain test-only.

### Reset Unity context pointers and override-container callers

Reset's three pointer calls resolve to ObjectPtr.Wrap<Entity>, Wrap<Ability>
and Wrap<Projectile>, not directly to the constructor. Method specifications
269317/269312/269319 have no fabricated concrete native mapping. The independently
mapped Object canonical Wrap specification212603 binds the actual shared body
0x4035830, which clears its16-byte result and calls the retained constructor
0x477cc20. All three context lineages reach UnityEngine.Object. The constructor's
two UID calls and the validity getter's UID call bind IPtrObject.get_instanceUid,
interface slot0, through their exact encoded metadata type loads.

`fearProjectileContextPointers` implements the selected constructor, validity
and Lock ordering with explicit UID/Unity/lifecycle receivers. Null or first
UID0 captures a null pointer. A nonzero first UID stores the object before the
Unity destruction check; a destroyed object therefore retains its reference but
gets cached UID0. Otherwise construction samples UID again. Validity checks the
initial object for destruction, rereads the by-reference obj slot, obtains its
current UID, then rereads cachedUid. Lock rereads obj again after successful
validity. There is no invented nonzero-UID or second-destruction gate.

The override source additionally resolves all eight generic method-spec loads
to Dictionary<string,OverrideGroup>, its KeyCollection and Enumerator. The
actual map field is m_buffOverrideMap atoffset0x20. Concrete mappings remain null;
generic storage/comparer/enumerator effects are not asserted from caller names.
`fearProjectileOverrideContainer` supplies the retained caller behavior: return
the first native StartsWith match, dispose on match/exhaustion/error, otherwise
return the input key. Migration captures TryGetValue's out group, skips absent
base or existing destination, rereads the map for each operation, ignores
Remove's bool and then Adds the original group, including a null value.

The composed Reset test now uses both adapters. It checks all three captured
UIDs, invalidation after source UID replacement, and migration of the same
override-group object to the character-specific key. Additional tests cover
destroyed captures, second UID0, by-reference mutation between native calls,
enumerator version exceptions/disposal, lifecycle invalidation, map replacement,
ignored false removal and committed removal when Add fails. All876 focused
native/fear/family/miner tests pass. The source producer reproduces143 ordinary
methods plus the newly retained canonical Wrap body and metadata bindings.

Continuation40551627273 at0ad5dc48 passed; full40550025781 at93014b95 remains
active. Native Unity/UID dispatch, dictionary storage/culture/version effects,
frame/cross-version parity and live controller/stage integration remain open.
All source/support/receipt/catalogue gates remain unchanged and new stages are
still test-only.

### Reset override keys and composed initialization pipeline

The143-method artifact additionally retains BuffData.GetOverrideKey, both
BuffContainer override-key methods, Buff's override-key accessors, the
Character card-UID getter and the two HGString.Format overloads called by
Reset. Encoded metadata literals bind the exact format `{0}{1}` and separator
`^`. Disabled overriding returns System.String.Empty, bound through its actual
IL2CPP_TYPE_STRING metadata entry and static field0. Otherwise null/empty
overrideKey falls back to buffKey; whitespace and nullable buffKey are preserved.

For independentCharacterSource=false, Reset installs that key directly. For an
independent source it tests the original source's Character type, rereads data,
formats key plus `^`, then tests the selected Character for Unity null. A valid
Character contributes its signed card UID through the integer Format overload.
Reset writes the resulting key, reads the installed property again, and only
then calls EnsureOverrideIndependentKey(base,key). A missing or destroyed
Character instead uses GetOverrideKeyCandidate(base) before the common setter.
Disabling overriding does not skip this independent-source suffix handling.

`fearProjectileResetBuffOverride` implements this branch order with explicit
formatting, type/Unity validity, card-UID and container receivers. The retained
candidate method scans existing keys using native StartsWith and disposes the
enumerator on match, exhaustion and exception. Ensure performs TryGetValue,
ContainsKey, Remove and Add in order; these container effects are retained source,
not yet certified as a concrete runtime binding.

`fearProjectileResetBuff` composes context, blackboard/lifecycle preparation,
lifetime, triggers, stack initialization, attributes, actions, priority, override,
status and final flags in the retained default order. It sets stack count1,
copies both stack-refresh flags from one captured data object, reads template
actions after attribute effects, and passes a value copy of BuffConfig's two
references to priority calculation. Lifecycle invalidation or an exception stops
later phases while preserving earlier mutations; retry and reentry are covered.

A composed test uses the concrete phase implementations and checks blackboard
duration/interval overrides, Q32.32 timing, rebuilt attributes, priority2000,
the card-specific override key and installed shield/status flags. A second pass
reuses a pooled buff, preserves its new allocation UID/validity, clears old
actions and status flags, and retains the native stale shield mask when no
visible shield exists. Per-phase cancellation, late template reads, config
snapshot identity and partial failure/retry are also covered. All852 focused
native/fear/family/miner tests pass. The source producer reproduces143 methods.

Continuation40550004465 at93014b95 passed; full40550025781 at the same commit
remains active. The earlier full40540699414 ate8664584 passed. Full native
pointer/audio/container effects, runtime frame/cross-version parity and live
controller/stage integration remain open. No enemy/stage support, receipt or
public catalogue gate changes; new stages remain test-only.

### Reset configuration, source context and audio-hook ordering

The135-method artifact additionally retains BuffConfig.GetEffectKey and
GetOnEventPriority, Buff's audio getter/setter and effect setter, and
Character.TryHookAudio. BuffConfig is a value type: metadata's boxed offsets16
and24 correspond to unboxed template/data offsets0 and8. Effect override uses
String.IsNullOrEmpty; whitespace is an override. The nonempty branch rereads
config.data before returning its override. Event priority uses the override
Boolean, otherwise the template's signed Int32 priority.

Reset's audio cast resolves to Character, and its original source receiver's
virtual slot106 resolves to TryHookAudio(signal,subSignal,out newSignal,
out newSubsignal). It captures AudioSignals.SIGNALS_WITH_BUFF once, rereads the
buff's audio subsignal before each attempt, and stops at the first true return.
It installs only newSubsignal; newSignal is not installed. The two output slots
are initialized once and reused across failed attempts. Source, ability and
projectile pointer construction then occur in that order, followed by one data
read supplying the six initial durability/miss/control capability fields.

`fearProjectileBuffConfig` and `fearProjectileResetBuffContext` compose these
selected default branches. Source validity, Character casting, signal-array
retrieval, virtual audio effects and pointer construction remain explicit
receivers. The implementation does not substitute the plain Buff ObjectPtr
adapter for the Entity/Ability/Projectile contexts. It preserves earlier writes
on errors, rejects reentry, and stops after lifecycle invalidation at external
effects. It neither clears later Reset state nor changes pool UID validity.

Tests cover nullable/empty/whitespace overrides, missing fallback templates,
repeated data reads, skipped audio branches, original virtual receiver identity,
shared outputs, first successful audio replacement, pointer/capability ordering,
partial failure/retry, reentry and lifecycle cancellation. All815 focused
native/fear/family/miner tests pass, and --check reproduces the135-method bundle.
Continuation40547363172 at8efd48d9 passed; full40540699414 ate8664584 remained
active when rechecked. Full Reset composition, native audio/pointer effects and
live controller/stage integration remain open. Source/support/receipt/catalogue
gates are unchanged; all new stages remain test-only.

### Final elemental-break and shield-source flags

The129-method artifact additionally retains _InitIsEpBreakBuff, _InitShieldSource,
set_hasShield and BlockDamage's showShieldUI/damageMask getters. The selected
database singleton specification binds EPBreakBuffDB without inventing a native
mapping. The break scan checks each enumerated record's key list against the
current buff key and disposes on first match, exhaustion and exception. The buff
key is read before a missing key list fails. Native database/iterator effects
remain explicit receivers.

`fearProjectileInitBuffFinalFlags` preserves that scan and its disposal ordering
before writing m_isEpBreakBuff. Shield initialization clears hasShield, retaining
the prior mask, then scans event10/ON_TAKE_DAMAGE's action-node array. Null nodes
are skipped before casting. The first BlockDamage whose showShieldUI getter is
true sets hasShield before reading/writing its mask; later actions are ignored.
No action executes during this discovery. Native casts/getters remain explicit.

Tests cover exact key membership, first-match/exhausted/error disposal, opening
and disposal invalidation, missing records/lists, null and nonshield nodes,
first-visible shield, live action changes, partial mask-getter failure, reentry
and lifecycle cancellation. An action-loading/final-flags composition discovers
the installed shield array. All793 focused native/fear/family/miner tests pass
and --check reproduces the129-method bundle. Full Reset, native database/cast
effects and live controller/stage integration remain open; all gates are intact.

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

### Buff.Reset lifecycle-field block

The85-method artifact now retains Buff.Reset's complete896-instruction default
method and chained chunks, including the hotfix branch. Its selected lifecycle
block clears started/finished together, then needRemove/actuallyEnabled/
lateEnabled/manuallyEnabled together, then actuallyFinished. It subsequently
clears the optional derived-buff list's contents. This is reference clearing,
without a per-child Finish action. Allocation UID/validity are separate from
these writes.

`fearProjectileResetBuffLifecycle` projects precisely this block onto writable
native Boolean fields and a nullable derived-list array. It preserves that
array's identity and does not change the allocation identity, source, blackboard
or timing fields. It is explicitly not the full Reset method. A default-pool /
UID / queue composition recycles a prior finished body, allocates it under a
fresh UID, and resets lifecycle flags while the new ObjectPtr remains valid
and the old one remains invalid. Other tests cover nullable lists, repeated
Reset, non-finishing of retained child objects and accessor rejection.

All599 focused native/fear/family/miner tests pass and --check reproduces the
85-method evidence bundle. Native derived-list versioning, Reset's context,
blackboard, timing, action and attribute effects, live lifecycle phases and full
controller/stage integration remain open. No support or catalogue admission
follows from the selected lifecycle block.

### Buff.Reset PeriodicTimer operations

The88-method artifact additionally retains the specific FP PeriodicTimer.Reset
overload called by Buff.Reset, MarkInvalid and SetRemainingTime. Separate native
math records retain their signed min/max calls and complete seven-byte signed
Int64 comparison leaves. Reviewed leaf extraction does not weaken the shared
native-code reader. The Reset call binds the interval and initial-wait flag;
the later optional first-interval override calls SetRemainingTime.

`fearProjectileBuffTimer` projects these operations onto the retained period and
remaining-time fields using signed64 Q32.32 BigInts. Reset chooses max(0,period)
and starts remaining time at that period or zero according to the wait flag.
MarkInvalid writes negative one second to both fields. SetRemainingTime chooses
min(requested,period), preserving negative values rather than inventing a zero
floor. No float conversion or scheduling phase is inferred.

Tests cover stale state replacement, delayed/immediate first trigger, invalidation
and subsequent reuse, period capping, negative/sub-tick values, full signed64
precision, invalid input and pooled-body/timer identity retention. All605 focused
native/fear/family/miner tests pass and --check reproduces the88-method bundle.
Buff-specific blackboard interval/count setup, trigger configuration, lifetime
adjustments, timer advancement, full Reset and controller/stage integration remain
open. Existing source/support/receipt/catalogue gates are unchanged.

### Buff.Reset trigger count and interval setup

The91-method artifact additionally retains Blackboard.GetFpOrDefault,
GetIntOrDefault and Buff.set_triggerable. Three exact metadata string-literal
loads identify interval, trig_cnt and first_trigger_interval. The reviewed
18-byte conditional leaf returns zero for byte0, the supplied fallback for
byte2 and the supplied count for other nonzero values. It is not a Boolean
ternary. Complete bytes include its internal branch and both returns.

`fearProjectileResetBuffTriggers` implements this selected configuration sequence
using explicit native data, blackboard, conversion, timer and lifecycle receivers.
The initial count is zero, negative one or the selected configured count. A
fresh trigger-life read decides timer invalidation versus the enabled path.
The enabled path reads interval, overrides count, rereads the initial-wait flag,
resets the timer, then applies a first-delay override only when positive.
The final triggerable setter receives count>0, including false for the negative
one sentinel; no invented infinite-trigger shortcut is applied. Data and count
are reread at their native effect boundaries. Completed mutations survive a
later exception; recursive configuration is rejected and invalidated lives stop.

Tests cover exact lookup keys/defaults/flags and ordering, disabled triggers,
byte2 and other nonzero values, count/interval/first-delay overrides, negative
first delays, mutable configuration, errors/retry, reentry and lifecycle changes.
Concrete PeriodicTimer composition verifies positive overrides cap at the period.
All619 focused native/fear/family/miner tests pass and --check reproduces the
91-method bundle. Continuation40535732403 at9a5bc3e1 passed; the existing
full40533531161 atd74e28a3 remains active. Full Reset, live timer scheduling and
controller/stage integration remain open. All existing gates remain intact.

### Buff.Reset lifetime selection and final-state copies

The93-method artifact additionally retains Buff's static constructor and
_ModifyLifeTimeFinally. The static constructor initializes INFINITY_TIME by
converting integer-1 to FP, producing negative one second. The selected native
Int64 conditional leaf chooses zero for byte0, that infinity fallback for byte2,
and the supplied lifetime otherwise. Its complete20 bytes include both internal
branches and all three returns. The exact fallback string literal is duration.

`fearProjectileBuffDurationKey` selects duration only for null/empty keys; callers
capture this before the blackboard merge, as in Reset. The later
`fearProjectileResetBuffLifetime` uses that captured key and the explicit native
TryGet found/out result. It writes the out field even when lookup fails, before
fallback float conversion. It then reads lifetime type, applies the selected
conditional, calls the required final modifier, copies the modified lifetime
to remaining time and resets existing time to zero. Exceptions and invalidated
lives preserve earlier writes and skip later state copies. Modifier effects
are retained source but remain an explicit, unverified receiver.

Tests cover custom/whitespace/default keys, lookup success without conversion,
signed64 precision, finite negative values, all selected conditional outcomes,
modifier-before-copy ordering, failed fallback/modifier partial state, repeated
data reads, reentry and lifecycle cancellation. All632 focused native/fear/family/
miner tests pass and --check reproduces the93-method bundle. Full Reset,
modifier effects, live lifecycle phases and full controller/stage integration
remain open. Source/support/receipt/catalogue gates remain unchanged.

### Final lifetime modifier for heavy-enemy levitation

The95-method artifact additionally retains Buff.get_owner and Enemy.get_massLevel.
The exact type metadata load in _ModifyLifeTimeFinally resolves to Enemy, and
virtual slot198 resolves to get_massLevel. The abnormal attribute input25 is
LEVITATE in the retained enum. The selected default path validates the first
owner read, reads owner again for the Enemy cast, validates that Enemy, checks
the buff's levitation flag, then divides lifetime by FP2 only for massLevel>3.
The native FP division body is separately retained alongside the call binding.

`fearProjectileModifyBuffLifetime` now implements that branch with explicit
owner/type/Unity-validity/flag/mass readers. It uses the already reviewed native
division algorithm through a shared signed-Q32.32 entry point, preserving native
rounding rather than truncating BigInt division. It does not add an infinite-
lifetime exemption or a general status-resistance rule. Recursion is rejected;
invalidated lives stop after each external effect.

Tests cover strict mass threshold, absent/non-enemy owners, missing levitation,
two different owner reads, signed fractional rounding, negative sentinel input,
reentry and cancellation. A composed lifetime Reset verifies the concrete
modifier runs before remaining-time copying. All645 focused native/fear/family/
miner tests pass. Full native owner/flag effects, Reset integration and live
controller/stage phases remain open; support/catalogue gates are unchanged.

### Reset blackboard copies, prefix assignment and duration fallback

The103-method artifact additionally retains the selected Blackboard copy
constructor, Assign overloads, AssignByPrefix, AssignValueStrByPrefix, ContainsKey,
TryGetFP and Buff.get_key. The exact format literal is {0}. The virtual Equals
dispatch helper is retained separately; concrete Equals behavior is not inferred
from reference identity. Copy checks precede lifecycle clearing and destination
blackboard clearing. Duration-key selection precedes the subsequent assignments.

`fearProjectileResetBuffBlackboard` composes these native operations. Nonnull
inputs matching the destination under the supplied equality receiver are copied
before clear. Ordinary assignment applies first input, second input, then data.
The selected prefix branch rereads buff key and applies both prefix operations
for each input before data assignment. Only when the destination lacks the
captured duration key does it probe both source inputs for duration. Both out
writes are preserved: a failed second lookup can overwrite the out value even
when the first lookup succeeded, while the combined found flag remains true.
No early-success shortcut or general Map merge parity is claimed.

Tests cover alias copies, virtual equality, assignment order, both prefix
operations, data-provided duration, missing duration, the failed-second-lookup
case, repeated key reads, exceptions/retry, reentry and lifecycle cancellation.
A composed default-pool/lifecycle/blackboard/lifetime/trigger/timer test carries
alias-preserved duration and trigger overrides into a freshly allocated body
without changing its UID/validity. All665 focused native/fear/family/miner tests
pass and --check reproduces the103-method bundle. Continuation40537355768 at
92b9df4d passed; existing full40533531161 atd74e28a3 is still active. Concrete
blackboard operations, full Reset and live controller/stage integration remain
open. All source/support/receipt/catalogue gates remain intact.

### Blackboard numeric/string prefix traversal

The104-method artifact additionally retains Blackboard.DataPair.get_isStringValue
and its exact fields. The numeric and string prefix methods both call StartsWith
with comparison5 (OrdinalIgnoreCase), strip prefix.Length UTF16 units and reread
the source index for their assignment value. The string path first checks a
separate DataPair copy for nonnull/nonempty valueStr, then rereads the source for
the string write. Numeric writes pass the source float independently of valueStr.

`fearProjectileBuffPrefixAssignments` implements the selected indexed list
traversal on an explicit DataPair array projection. It rereads live count and
indexed values, preserves the first key for prefix stripping, keeps numeric
float32 and nullable string writes distinct, and skips empty string-value probes.
Native OrdinalIgnoreCase comparison and destination writes remain mandatory
receivers; no approximate JS Unicode folding or complete Blackboard storage
parity is claimed. Both operations share a reentry guard and stop on lifecycle
invalidation after external effects.

Tests cover prefix filtering/stripping, comparison5 delegation, separate writes,
empty/whitespace values, repeated source reads, list growth/shrinkage, nonfinite
native floats, null/empty input, write exceptions/retry and lifecycle cancellation.
A Reset composition uses both concrete traversals before duration fallback.
All675 focused native/fear/family/miner tests pass; --check reproduces the
104-method evidence bundle. Full native Blackboard storage/equality/string
comparison, full Reset and controller/stage integration remain open. Existing
source/support/receipt/catalogue gates remain unchanged.

### Blackboard whole-pair numeric/string writes

The110-method artifact additionally retains the numeric/string Assign overloads,
both DataPair constructors, and the actual mscorlib String.ToLower and selected
String.Compare wrapper. Cross-image methods resolve through mscorlib's own
pointer table. The complete14-byte Compare wrapper passes the ignore-case bool
to its comparison-enum overload. The latter body's strict reader failed complete
disassembly, so that body is explicitly not certified or retained; its unsupported
range does not relax the shared reader or become fabricated evidence.

`fearProjectileBuffBlackboardWrites` implements whole-pair construction and
indexed replacement on the List<DataPair> array projection. It lowers the new
key before searching, compares each stored key against the original input with
ignoreCase=true, replaces only the first match in place, and otherwise appends.
Numeric writes use float32 and clear valueStr; string writes set numeric value
to zero and preserve the nullable string. Casing and comparison remain explicit
native receivers, rather than using JS culture behavior as native parity.

Tests cover replacement across value types, ordering, later duplicate retention,
original-key comparison, nullable/empty strings, list mutation, invalidated lives,
errors/retry and reentry. Prefix traversal now composes with these whole-pair
write receivers. All684 focused native/fear/family/miner tests pass. Hosted
continuation40539231228 ate94e018a and full40533531161 atd74e28a3 both passed.
Culture effects, native list versioning, full Reset and live controller/stage
integration remain open. No source/support/receipt/catalogue gate changed.
