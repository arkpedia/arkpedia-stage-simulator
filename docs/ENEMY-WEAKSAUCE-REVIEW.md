# Weaksauce contact program

Weaksauce now uses a shared contact trigger and a compiled native buff program. Its 0.1-radius native circle selects an eligible ally whose collision body touches it. The native program applies one source-ATK physical hit and then kills the source. It does not invent a normal attack, projectile clock or cooldown. The source buff makes the damage unmissable; defence and invulnerability still use the normal damage pipeline.

The compiler now supports the bounded native AdvancedApplyDamage contract (physical, Arts or true damage with optional blackboard scale/default) and the native InstantKill source-only contract. Every field is checked before execution. Optional scale values are validated before any mutation. A source redeployed by a damage callback cannot be killed by the old program’s following action. Programs remain immutable, bounded and deduplicable through the existing component store.

The contact transport tracks separate target deployments, removes contacts that leave, and permits a fresh entry. It stops when the source dies. Native record, custom-root identity, no-attack mode, range geometry, validator, buff attributes and native action fields are checked before admission. The isolated mapping does not certify native contact callback ordering when several bodies arrive simultaneously.

Ninety focused tests pass. Desktop and touch fixtures load only the contact module, produce one defence-reduced hit, respect stealth until it ends, kill the source and emit no ordinary attack. The broad suite run for the compiler/body changes has 1,801 passes, three skips and the same two known Chimera failures. Native effect/mesh artwork remains pending: this actor has no Spine binding, so no model or invented animation is published.

Combat admission rises from 725 to 726 enemies (791 levels). Original stage graphs stay pinned at 970 available stages until the stages phase. This is combat coverage, not a claim that original visual effects or every stage using the enemy are complete.
