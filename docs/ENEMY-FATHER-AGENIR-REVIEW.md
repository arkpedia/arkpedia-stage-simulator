# Father Agenir

Father Agenir (`enemy_1284_sgprst`, both database levels) is admitted from his pinned CN prefab and the pinned Global buff templates. He has three source facts, each mapped to one reusable component.

**Magazine hits.** His native SP gauge is a magazine: maximum 10, initial 10, no recovery. Both attack packets carry the same unmissable arrival buff. When it starts on the hit target it checks that its source still holds one round, adds one permanent uncapped flat DEF stack (`Passive.attack@def`, −300) to the target, then takes one round from the source. An empty magazine stops that sequence, so later hits are ordinary. The simulator reuses the existing `enemyAmmo` account, so stage ammunition devices see the same magazine.

**Asset Liquidation mode.** The common `enemy_common_check_vg` checker, already compiled for the Crossbowmen, polls every half second (first poll after one interval, not silenceable). With the `vgctrl_s[aura]` marker he switches to the second native mode: the 60-frame `Skill` clip with its frame-43 release, the `projectile_enemy_sgprst_s` carrier and a global selector. Without it he uses the 40-frame `Attack` clip with its frame-23 release and the record's 1.9 radius. Both selectors accept ground and flying targets. A cast keeps the mode it started in. Each mode's visual passive is attached as that mode's marker.

**Blood Debt link.** `enemy_sgprst_vg_add` runs once, when the passive starts. It selects one `vgctrl`-tagged device anywhere on the field and leaves a derived, infinite, one-second `modify_sp[trigger_with_no_ui]` buff on it, adding `Passive.sp` (2) each second, first after one second. The derived buff finishes with its parent. A controller that appears later is never acquired; a receiver that leaves takes only its own link with it. Stun does not interrupt the link, because the buff lives on the receiver.

## Shared changes

- The native buff compiler accepts the silent variant of the nonnegative target `ModifySp` (the popup flag is presentation only) and the native empty-key `CreateEffect` placeholder, which creates nothing. Signed and owner-bound SP remain unsupported in portable programs; Agenir's own round spending is an exact-template gate over the existing ammunition account instead.
- `programmedProjectileModes` gained an optional per-mode `globalRange`, an optional shared magazine (`ammo`) and an optional per-mode `ammoHit`. Existing consumers pass none of them and are unchanged.
- `selectedSpLink` is a new on-demand runtime kind for start-only selected periodic SP links.
- `tools/arkpedia/test-assets.mjs` accepted one skeleton path only from one assets pin. Explicit shared-model aliases are published by a later pin but name the same bytes, so the inspected recent CI runs stopped at that step. Equal bytes at one path are now one download; different bytes at one path are still refused.

## Verification

All 13 family tests pass, covering raw and compiled records. The focused run of the Famiglia families, the native compiler, ammunition, runtime plans and runtime loading passes 385 of 385. The desktop and touch browser fixtures pass at both database levels on the default compiled stage geometry with a deployed operator as target: two SP each second on an explicit tagged receiver, no acquisition outside 1.9 without the marker, the `Skill` and `Attack` clips, one round per DEF stack, both killed receipts, link removal on death, and selected loading of only the three needed runtime modules with no source catalogue requests. The original body decodes six clips and renders in both galleries. All 970 pinned stage graphs pass ten-second runtime smoke.

The broad simulator and content run measured the recorded baseline exactly: 1,806 tests, 1,801 passes, three skips and the same two Chimera failures. Those two tests were stale against the reviewed Chimera controller and the shared pollution registry, and were then updated: activation is no longer expected while stunned or within 0.3 seconds, and pollution packets are matched by their tag instead of a credited source. One older claim, that the pollution aura grants hurt SP and triggers a Defender skill, contradicts the registry's deliberate no-SP packets and is kept as a visible `todo` test instead of being deleted or flipped. That file alone was rerun afterwards (16 tests, 15 pass, 1 todo); the broad run was not repeated.

Coverage reaches 769 of 2,163 enemies, 835 database levels and 214 runtime kinds.

## Boundaries

- The fixtures use an explicit SP receiver and an explicit aura marker. The native Blood Debt controller (`trap_092_vgctrl`) is not admitted, so no original Il Siracusano stage is certified.
- A round is spent, and a stack added, only while the source is still the same live deployment when the projectile arrives. That guard is the simulator's choice; the native result of the source check on a dead source was not established.
- The DEF stack is applied after the hit's damage, like the existing stacking DEF reduction. The native order between an attack's arrival buff and its damage was not established from method bodies.
- The round check at arrival reads the retained default of one round; whether the native check can instead read a blackboard `sp` value was not established from method bodies. The handbook text (capacity 10, each paid attack reduces DEF) matches the default.
- Effects, audio and frame/pixel parity are not reviewed.
