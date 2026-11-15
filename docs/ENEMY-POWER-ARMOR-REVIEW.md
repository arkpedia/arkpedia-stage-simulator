# Assault Power Armor

The two original R-11 Assault Power Armor records now share a blocked-melee /
unblocked-projectile adapter. When unblocked, ordinary target priority chooses
up to four ground targets within the original range. Each receives a travelling
single-target Physical hit for 50% ATK. Blocking switches the next attack to
one full-ATK Physical melee hit against the blocker. Silence does not disable
these ordinary attack modes. Flying, stealth and camouflage exclusions use the
shared target selection rules.

The native source retains both mode attack components, their selector, trigger,
metadata and kill-log binding. The projectile has speed 10, a 10-second lifetime,
a single traced-target hit and no area collider. Its source-invalid policy
allows released shots to survive the shooter's death. Their ranged damage
scale remains fixed when the shooter becomes blocked before impact; current
ATK is read at impact while the source lives, with the release snapshot retained
after death. Other projectile families reuse the existing transport unchanged.

The original record carries `Passive.attack@ranged.atk_scale = 0.5`; the
ranged ability has the `ranged.` metadata prefix. The source selector's limit
is four. The [PRTS enemy page](https://prts.wiki/w/R-11%E7%AA%81%E5%87%BB%E5%8A%A8%E5%8A%9B%E8%A3%85%E7%94%B2)
and [Terra Wiki](https://arknights.wiki.gg/wiki/R-11_Assault_Power_Armor)
corroborate the split between ranged and melee attacks. Altered challenge
selectors/scales need a separate parameter contract and remain outside this
admission predicate.

The common enemy attack event can now carry an explicit animation role, which
the existing browser actor already understands. These records choose `Attack`
or `Attack_2` with the combat mode. Both original clips are two seconds with
an `OnAttack` event at the retained single-precision 5/6-second mark. Existing
common enemy attack scheduling is unchanged; this is not native frame parity.

Original normal and elite bodies are published once in the shared SD store at
`0eec0ea50a2bf575147ee54581db916c09d0d685`. Their artwork differs, so they are not
shared-model aliases. The simulator references those immutable model records.
The SD store passed 93 tests and validated 3,707 complete models. Browser
asset delivery decoded 18 clips across both bodies on desktop and touch, with
no recorded browser or model-fetch errors. The touch idle gallery was visually
reviewed. This gallery is not a battle-fidelity certificate.

Six focused tests cover target count/priority, half/full damage, ground-only
selection, blocker-only melee, both animation roles, in-flight source death and
blocking, Silence, camouflage, and native-source mutation rejection. The shared
`Passive` name now has a record-signature guard, preventing unrelated enemy
families from receiving the legacy Decode Basis adapter. The derived support
publisher also checks that no previously supported record is removed.

Dormant power-armour device activation, their supporting engineers and other
stage-specific dependencies remain independently gated. Supporting the moving
enemy does not treat an unimplemented device as complete.

The combined enemy, core combat, attack-standing and danger checks passed all
382 tests, including the catalogue-wide enemy constructor/runtime sweep. All
882 available stages again passed the 10-second runtime smoke check. Native
support and the lightweight operator library match their generated sources.
No additional stages became loadable in this batch because their remaining
device, enemy or mode dependencies are still explicit blockers. See the
checkpoint receipt `data/arkpedia-enemy-power-armor-review.json`.
