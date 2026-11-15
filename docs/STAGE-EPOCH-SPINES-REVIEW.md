# Spines of Epoch

Spines is an atomic member of the existing placed reward-device family. Its
native talent creates the same neutral Mark of Epoch used by Dreadkaz, and
removes that specific Mark when the talent finishes. It has no separate damage
implementation, copied stage script, or duplicated Mark artwork. Other emitters
continue to cover their tiles after a Spine is removed.

The original record gives 12,000 HP, 1,200 DEF, 50 RES, zero block, and taunt 1
at every supported level. The native passive grants stun, frozen and sleep
immunity, but not silence immunity; the field itself is unsilenceable. The
source's self-marker buff is retained. Spines is an enemy-side character-category
device, while its Mark is neutral. Neither consumes a deployment slot, enters
the defeated-enemy total, nor blocks wave clearance. Its native `log_killed`
action records one `killed` result with the device identity. The caller may use
that result for run rewards; the simulator does not invent a Plan wallet.

Hidden placements activate through the existing original alias scheduler.
Repeated activation is idempotent, and an occupied placement cannot leave an
orphan Mark. The stage compiler follows device `spawns` dependencies through the
same enemy graph, ensuring the Mark record is present. Character-category reward
devices now expose that category to tile fields instead of being treated like
inert scenery.

All 344 cached original placements across 163 levels use `skillIndex: -1`,
consistent with a record that has no skills. Only that index is admitted for
Spines; the existing instance validator still rejects changed skill/talent
blackboards, equipment, trust, potential, and ambiguous aliases.

Forty-two focused and shared-device tests pass, including source mutations,
activation, overlapping fields, counter ownership, lifetime cleanup, status
immunity, and equality of compiled runtime definitions with source compilers.
All 344 original placements also pass instance validation. The shared compiled
store now contains 273 distinct definitions in eleven families, with no raw
device evidence in the browser runtime graph.

The original Spines body decodes three clips on desktop and touch, and the
desktop render was inspected. The asset store validates 3,760 complete models;
the simulator has eight additional device artwork records. Mark particles and
audio still use the explicitly labeled temporary tile overlay described in
`ENEMY-EPOCH-REVIEW.md`. Coverage remains 684/2,163 enemies and 907/3,892 loadable
stages: these 163 levels still have other unsupported components.
