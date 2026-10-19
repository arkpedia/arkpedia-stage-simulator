# Hadiya implementation checkpoint

Hadiya (`char_394_hadiya`) remains outside the normal simulator roster. This
branch contains her source foundation, exact animation clocks, selected-build
validation, real-account DP transactions and a separately owned talent component.
It does not yet contain either complete skill sequence, ordinary attack dispatch,
equipment-adaptation controls or reviewed public artwork. Arkpedia app dev and
production remain held.

## Source

- Pinned table commit: `a550f5e048bb94e7cdefc6eb97a4091f0c4c7add`.
- Native resource: `26-09-22-07-47-20_6c71fa`.
- Foundation: 316,545 bytes; SHA256
  `ffeebf810b1f0260d6062d57c1d9a7f00d3cab87650ae592fe175ca203aed27f`.
- Five bundles preserve 73 components, six transitive templates, both literal
  skill-prefab bindings and ranges `1-1`/`3-2`. There are no referenced projectiles,
  tokens or native/JSON template gaps. Pointer IDs remain strings.
- Independent source audits on Node 22 and 24 each reproduced seven outputs and
  rejected 29 altered source/approval claims.
- Exact Front/Back clocks are reproduced from the original SHA-checked skeletons.
  Ordinary A/B release is 0.5333333611488342; S1 cast release is
  0.1666666716337204; S2 Begin/Loop release is 0.4333333373069763. Missing Back
  `Die`/`Skill_Down_2_Loop` clips are not fabricated.

## Implemented components

- Select both skills at all ten ranks, enforcing promotion/level, potential,
  trust, skill unlock and no-module constraints.
- Keep printed ATK separate from talent stacks: E1 gains 2% per stack, up to
  three; E2 gains 4%, up to five. Potential 5 raises those to 3%/5%.
- Wrap the actual selected `SkillRuntime` activation rather than create a second
  SP account. S1 normal activation costs no DP; S2 costs 10 DP.
- Reserve/refund only the action's DP. Reject insufficient DP/SP, stale accounts,
  control, repeated/reentrant actions and free-SP bypasses. Preserve independent
  ledger changes and the DP cap. Accepted casts commit through onStart removal.
- Support one paid adaptation per activation: S1 costs 10 DP and can start a
  full-SP skill; S2 costs 15 DP and permits adaptation only while active.
  The skill owner still has to supply the corresponding buffs/deadlines.
- Grant the original talent once at accepted deployment, without inventing a
  positive-DP-spend condition for Born.
- Admit subsequent talent events only through explicit owner-authorized receipt
  identities. S2 uses the extended displayed range even before mode entry.
- Keep ATK admission and stun as independent source actions. Stun still works at
  stack cap or after a rejected stat buff, follows ground targeting and shared
  immunity/resistance, and survives its nonderived source parent's removal.
- Clean only owned ATK/parent resources on loss/replacement/removal. Replaced
  foreign buffs and unrelated recipient statuses remain intact.

## Remaining work and fidelity limits

- Implement original default/S1/S2 attack dispatch, target limits and clocks.
- Implement both complete cast/mode/buff/end owners and the adaptation UI.
- Reproduce S2 duration extension and original-deadline restoration on extension
  buff removal, using the real skill account.
- Verify original art delivery, renderer integration and desktop/touch gameplay.
- Review the complete candidate before normal-roster admission or a ready PR.

DP reservation/callback order, deployment-to-Born timing, template-to-blackboard
stack-cap binding, purposeMask `NONE` target legality, range extension and exact
same-tick ordering remain declared local mappings. Sleep, stealth and target-free
currently follow existing shared legality; camouflage does not become an attack
filter for this buff selection. Original template `maxStackCnt=1` is preserved in
evidence rather than edited to match the selected printed cap. Compiled native
action semantics, frame/pixel parity, modules and native effects are unapproved.
Source and clock `enabledOperators` stay empty. Normal coverage remains 403/431
forms; these private components do not increase that count.

## Verification

The related regression ran on Node 22.23.3 and 24.21.0: 1,846 cases on each,
1,843 passed, three optional skips, no failures. It includes the selected Hadiya
components, Makoto/Koromaru source runtimes, CN native-source checks and existing
simulation tests. After the final pre-install cleanup correction, all 78 Hadiya
cases passed again on each version without skips. The existing port-3182 preview
still responds with HTTP 200 and serves the unchanged 403-form normal roster.
