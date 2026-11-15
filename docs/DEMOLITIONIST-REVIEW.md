# Demolitionist and Demolitionist Leader

The original `Combat` component deals a full physical ordinary melee hit and
attaches the non-missable `bsthmr_range` buff to its target. On finishing, that
buff deals Physical splash with `atk_scale=0.5`, excludes the primary target,
uses WALK_ONLY targeting and does not require the primary target to remain
alive. Its blackboard selects `range_id=x-5`.

The pinned CN range table proves x-5 is the center and four orthogonal tiles,
not a 3×3 square. The verified range entry is retained once alongside native
ability evidence; the extractor checks both the table's SHA-256 and Git blob.
The feature predicate checks the range, target exclusion, source/application
mode, damage kind and non-missable buff. It refuses changed semantics.

Runtime uses the shared `secondaryAreaAttack` factory and normal tile/area
selection. The original primary hit stays unchanged; the separate half-ATK
splash does not recurse or count as another ordinary attack. It ignores
camouflage, respects stealth and excludes airborne units. Silence does not
remove this attack effect. Tests cover the cross boundary, no duplicate primary
hit, primary dodge/death, non-dodgeable splash and changed-source refusal.

The immediate buff-finish effect is mapped to the attack hit event. Exact
native ordering within that frame remains unverified; admission does not
certify client-frame parity.
