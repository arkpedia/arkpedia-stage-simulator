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
