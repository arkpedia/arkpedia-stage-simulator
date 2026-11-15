# Interference Mine

`trap_012_mine` is admitted from pinned character/skill tables and the original
token/skill prefabs. The extractor retains its circle and transform geometry;
shared buff templates are retained once through recursive dependency traversal.
PRTS: https://prts.wiki/w/干扰地雷 .

The supplied card costs 5 DP, has a 7-second deployment cooldown, occupies no
operator slot and can be placed on a vacant ground deployment tile. Original
stock is consumed independently for each copy. Retreat returns neither DP nor
stock. The body has 100 HP and zero block; it does not rewrite terrain.

A real automatic time-recovery skill starts at zero and requires 25 SP. External
SP and SP locks use the same account as operators. Stun/freeze defer activation
while natural recovery continues; the skill is not silenceable. A full charge
waits for a living ground enemy in the retained 0.55-radius selector, ignoring
stealth. Selection and blast share that selector. Ordinary enemy bodies use the
engine's point-radius convention; this is not a certification of Unity collider
boundary parity. PRTS describes the trigger approximately as the occupied tile.

The ordered native effects first apply a shared, non-stacking 1.5 damage-taken
multiplier for 15 seconds, then deal 2000 True damage. Thus the initial blast
normally deals 3000. Physical, Arts and True damage are scaled; elemental damage
is not. Later mines refresh one effect. Damage immunity remains owned by the
common damage pipeline. The mine withdraws after its release.

The charging/armed inspector shows actual SP. Native animation, VFX and the
separate visual-mode timer have not been imported or approved. The body uses
existing rendering and shared assets.

`configureStageSupply` centralizes identity, inspector metadata, zero-slot use
and retreat refund accounting for mines, demolition devices, obstacles and
range/pulse supplies. Immediate placement now selects the new supply, matching
the existing direction-picker flow. New supply implementations can use this
account and `SkillRuntime` without duplicating either lifecycle.

Validation: five mine behavior tests; 42 related supply, obstacle, pillar and
rule regressions. H7-3 is developer-only, with browser startup, all 50 scheduled
spawns, and a controlled browser card-placement / charging / detonation receipt.
These checks are not a playable-clear or native visual-fidelity approval.


## Preplaced bodies

Original starting mines now use the same `installStageMine` and supply inspector
as deployed cards. Original instance matching checks identity, coordinates,
initial activation, skill, level and overrides before the stage is admitted.
They start at zero SP without paying DP, consuming stock, starting a card
cooldown or occupying an operator slot. Hidden inactive instances are omitted;
scheduled activation and unsupported overrides remain blocked.

This shared capability admits S7-1, S7-2, MN-EX-6 and its challenge, and the older
SV-6 (`sv-6_act10d5_06`) and its challenge. Tests exercise every original layout,
charge/detonation, unchanged stock/starting DP, and retreat without refund.

S7-2 exposed an existing altar-selector error: the pulse included mines. The
retained `sktok_ore` selector has category 1, both sides/motions, unrestricted
count and ignore-target-free enabled. Category-2 stage objects are now excluded;
existing character-like summon/device profiles remain eligible. Native altar
prefabs and referenced templates are retained in the shared device evidence.
This correction does not certify the old altar clock: its native 0.6-second
casting delay and complete original animation timing remain to be implemented.
