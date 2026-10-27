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
`fearpj_m0_t[switch_to_die]` template and 36 complete default node/runner/entity/mode/FSM
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
