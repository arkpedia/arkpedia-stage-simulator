# Aphrissa source and held runtime review

Aphrissa (`char_4229_aphris`) remains outside the playable registry and normal snapshot. This branch contains original source recovery, selected build validation, exact animation clocks, a diagnostic normal relay lifecycle, a diagnostic ray geometry adapter and a held ordinary Arts attack controller. It does not implement her complete combat kit. The local normal preview continues to serve the reviewed Makoto build; Arkpedia app dev and production remain held.

## Original source

The foundation is 576,304 bytes, SHA256 `77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254`. It retains table commit `a550f5e048bb94e7cdefc6eb97a4091f0c4c7add` and native client resource `26-09-22-07-47-20_6c71fa`. Six original bundles supply 220 owner, artwork, skill and relay components, sixteen transitive templates, and three original skeleton facings. There are no referenced projectile prefabs or native/JSON template gaps. Full-width pointer IDs remain strings.

The relay `token_10070_aphris_pc` has three original promotion skill slots with literal null skill and override keys. These rows remain intact. There is no token skill table, named token skill binding, mode skill or inferred prefab. The generic extractor now avoids named-skill lookups for these literal placeholders; the independent verifier reconstructs their original table rows and rejects nonempty overrides. A named skill with a null prefab is still a different source case and is not removed by this change.

Sequential source audits on Node 22 and 24 each reproduce eleven original outputs and reject fifty altered source or approval claims, including missing/changed null slots and an invented null-key skill binding. The same generic change independently reproduces Mechanist's thirteen original outputs and rejects fifty-two altered claims while retaining its three named token skills. None of these source receipts approves public gameplay, modules, native particles or frame parity.

All thirty owner skill ranks retain their exact SP, duration, blackboard, promotion locks, potential and trust inputs. E0 Lv50/P1/trust0 has 970 HP, 567 ATK, 78 DEF and 31 DP with one relay. E1 Lv80 has 1261 HP, 727 ATK, 107 DEF and 34 DP, with the relay talent's 15% ATK value. E2 Lv90/P6/trust200 has 1660 HP, 1021 ATK, 128 DEF, 32 DP and 66-second redeployment, with 25% relay ATK and 13 fixed RES penetration. The ordinary source range includes five cells at E0 and six at E1/E2, including the owner's cell.

## Original clocks and modes

The six original modes are Default, S1, S3, S3 Down, S2 and S1 Down. Both owner facings preserve the 2.9000000953674316-second ordinary/S1 attack loops and their 0.4333333373069763-second OnAttack marker. S3's original loop is four seconds with its marker at 0.5 seconds; its selected BAT modifier is a separate input. S2 has no invented Spine OnAttack marker: the native ability uses its own time-driven damage clock, with 0.16699999570846558 predelay and a 0.5-second trigger delta. S3 charges for the selected three seconds before its separate active ability; selected `attack@trigger_time` is twenty even though the prefab counter's default is forty.

The relay has only Single-facing Default, Start, Idle and Die, with unrounded durations 0, 1, 3 and 1 seconds. The original Back owner skeleton has no Die or downward tracks. The clock tool independently hashes and parses all three original skeletons, reproduces the retained events and rounded metadata, and refuses changed receipt or skeleton bytes. Animation durations do not establish compiled action timing or native frame parity.

## Held normal relay lifecycle

The relay uses its own fixed 500 HP, zero ATK/block, three-DP cost and thirty-second redeployment time. Its promotion talent supplies a 15/20/25-second normal lifetime. The source slot cost is zero; chosen facing is required, with no host-range restriction. The source passive flags map locally to invulnerability, ally isolation and heal prohibition; the source zero-block modifier is retained. The card, payment and cooldown remain separate from the operator's own card and skill SP.

The diagnostic controller supports low/high deployable tiles, original single-facing Start/Idle/Die, a passive lifetime gauge, expiry, manual withdrawal and owner retirement. It binds the original deployment life. It claims placement before callbacks, rolls back interrupted or failed births, prevents reentrant double spending, ignores stale removal callbacks, and preserves foreign resources and replacement deck entries. Owner death, withdrawal, replacement or battle end drains owned hooks and removes the linked relay. Control and hiding do not pause a previously deployed relay lifetime.

These are explicit local mappings: integer withdrawal refund uses `floor(3 × 0.5)`, matching StandardBattle's policy; timeout callbacks run at the tick's start timestamp; card recovery and cooldown dispatch use the existing simulator lifecycle. Native card/refund ordering, alias decoding and compiled timeout behavior are not proven. S1 permanent relay markers, the relay-presence owner ATK buff, the RES aura and S3 extra-card/reset/withdrawal phases require separate composition. No active owner skill is supplied by the relay test fixture.

## Held ray geometry

The geometry adapter emits no damage, attacks or skill activations. It retains the ordinary finite straight source grid, ID-only friendly relay validator and two-cell extension. S2 separately retains its infinite ray, OR validator for relay or operator mask639, and relay-only extension validator. It uses the simulator's existing cardinal directions and current grid occupants. It does not invent a same-host restriction for the native relay ID validator.

Grid-centre occupancy, operator mask639 mapping, relay isolation exception, rectangular map boundaries, first-arrival per-cell metadata and repeated-directed-arrival cycle termination are explicit local policies. Tests exercise real diagnostic relay placement, actual Beagle deployment, current facing changes, finite last-cell extension, other-source relays, hidden/enemy/removed exclusions and bounded cycles. These checks validate this bounded adapter; they are not independent proof of the native custom range class's traversal, continuous hit bodies or tie order.

## Held ordinary Arts attack

The ordinary controller requires an explicit owner-mode predicate. It retains original Start, facing-specific Attack/Attack_Down, the original 0.4333333373069763 OnAttack marker, native maximum animation scale one, and affectedBySlowDown. The marker resamples the diagnostic ray and captures each distinct legal ground/air recipient life. One shared ordinary attack receipt owns the batch. Separate Arts hits use live ATK and source hitInterval 0.05000000074505806 on the same ability clock; ordinary damage ignores DEF and retains normal RES and damage hooks. A recipient moving after acceptance stays captured; a later entrant or replacement life cannot join the batch. Control, hiding, mode departure and owner retirement cancel unborn work. Reentrant forceAttack and target replacement are refused; cleanup preserves foreign presentation state.

The source custom range and selectTargetTiming3 aliases, first-path-cell/stable-ID target order, retained recipient batch, sampled BAT/interval clock, same-clock hit stagger, initial birth hold and same-tick callbacks remain explicit local mappings. These are not compiled hit-order or native frame-parity proof. No native beam particles or effect assets are substituted. The fixture supplies no active owner skill, relay ATK buff or RES aura.

The initial selected source, clocks, relay, ray, ordinary attack and shared CN/summon/HUD/slow-down/Mechanist set passes 346 checks on each of Node 22 and Node 24. Frozen commit `3ee5e01c30c3d62f10ccb688b9aa2dd387ca1708`, tree `13f586e2577f82a35edeea370af05f45ecc4cfa5`, then passes the complete local Node 24 suite: 20,658 passed, 29 optional skips, zero failures/cancellations, 20,687 tests across 325 suites in 630.598 seconds. All 921 original skeletons verify. The first attempt lacked generated ignored browser vendor files; the normal vendor/setup scripts restored them before that successful full run. Tracked source was unchanged between attempts.

A later ownership review reproduces four further failures before correction: replacing the ordinary controller or relay controller did not retire the stale owner, a mode predicate clearing the phase during hit admission could still deliver a stale hit, and a throwing mode query retained the pending phase. Both controllers now require their exact current memory-slot identity. Staggered delivery rechecks phase identity after the mode predicate; query errors clear pending work before propagation. The updated related set passes 350 checks on each Node version without failures or skips. This executable follow-up is separate from the frozen complete-suite result above. A fresh complete and hosted release gate remains required after the full kit is composed.

## Remaining gates

- Review the held ordinary/ray local mappings and compose them with the owner modes and talents.
- Relay-presence ATK and the operator-only RES-penetration aura.
- S1 permanent token markers and its original mode/animation transitions.
- S2 channel, periodic damage, target changes and finish/control behavior.
- S3 charge, ammunition, extra relay stock, reset/withdrawal, per-cell extension damage and Slow payloads.
- Original public artwork/PMA validation, interface assets, actual desktop/touch review and unchanged original-wave clears.
- Complete frozen regression, all exact-head hosted checks and reviewed-tree publication before a ready PR.

Modules, native particles/audio and compiled/frame/pixel parity remain unapproved. The source checkpoint creates no public roster admission or Arkpedia app release.
