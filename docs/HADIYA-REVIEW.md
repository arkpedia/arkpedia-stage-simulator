# Hadiya implementation checkpoint

Hadiya (`char_394_hadiya`) remains outside the normal simulator roster. This
branch contains her source foundation, exact animation clocks, selected-build
validation, real-account DP transactions, separately owned talent and the composed
ordinary/S1/S2 combat controller. Equipment-adaptation controls, original public
artwork and browser/runtime admission remain unfinished. Arkpedia app dev and
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
  The composed skill owner supplies the corresponding buffs and deadlines.
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

- Add equipment-adaptation controls to the selected-operator UI.
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

## Composed combat owner

The held owner uses the original three attack modes. Ordinary/S1 select one
ground input; S2 binds `attack@max_target` to three and uses range `3-2`. The
two block slots never multiply either target limit. A retained batch owns one
shared attack receipt and one direct Physical damage packet per eligible original
recipient life, using live ATK and shared mitigation. Late entrants cannot borrow
lost inputs. No projectile or splash is substituted.

Source `maxAnimScale=1` caps sampled BAT/interval playback. Its independent
`affectedBySlowDown=0` elapsed channel is preserved. Acquisition waits for the
larger of the sampled attack interval or original release marker, rather than
forcing every art clip to finish. B/A replacement order is a declared local
alternation; compiled `loopType`/RNG behavior is not claimed. S2 keeps deployment
facing and uses its literal downward clip. Original Back has no death clip, so
that pose stays hidden; Front uses `Die` or `Skill_2_Die` by mode. Withdrawal does
not request a death pose.

Both manual skills can replace Born or ordinary windup without erasing positive
attack cooldown. At their original OnAttack marker, the stat producer independently
attempts S1 DEF or S2 ATK. Original clip completion independently attempts the mode
producer. Rejected primary, mode or extra buffs do not become an atomic rollback
of otherwise accepted native actions. S2's primary admission, rather than generic
DP spending, owns its talent trigger. Adaptation independently attempts its extra
buff and the source retrigger signal once, including S1's full-SP entry.

S1's admitted finite primary runs for its original 30 seconds from local marker
dispatch and bounds the real account; a missed/refused primary has the finite
activation-duration fallback. S2's base 20 seconds begin at local mode-producer
entry, independently of the earlier ATK marker. Its infinite ATK parent retains
the source 0.029999999329447746 skill-affecting check. Accepted adaptation extends
that base deadline by 15 seconds. Removing/replacing its extension restores the
original deadline; removal after that deadline ends the activation rather than
leaving a detached 15-second benefit. An extension accepted during startup stays
bound to the later mode-producer origin.

Cast control cancels unborn markers and locally follows the original sequence's
force-next flag into its mode producer. Already admitted nonsilenceable and
nonstunnable buffs remain through action control. Mode/primary removal retires
only this activation; owned-reference checks preserve foreign replacements.
Source S2-to-default mix rows select `Skill_2_End`. This local presentation lock
does not hold the already ended SP account, which resumes normal recovery.

Native event/selector aliases, exact cooldown origins, force-next interruption,
buff-to-account lifetime binding, callback/admission order, B/A selection,
displayed-range extension and End gameplay lock remain explicit local mappings.
Original template and prefab values are retained and guarded; compiled native
frame, RNG, blend/pixel and status-event parity are unverified. Public registry,
normal snapshot, browser assets and Arkpedia app branches are unchanged.

The composed-owner regression passed on Node 22.23.3 and 24.21.0: 1,939 cases on
each, 1,936 passed, three optional skips and no failures. This includes all 170
Hadiya source/clock/payment/talent/owner cases, with both skills at all ten ranks,
E1 potential/trust builds, real time-SP recovery and DP admission, original
four-direction clips, shared damage/attack receipts, rejected/replaced buffs,
extension restoration, transient controls, callback reentrancy and cleanup.
Private fixture clocks use the existing fixed-tick dispatch; the tests do not
claim compiled game-frame parity. The existing preview still serves the reviewed
403-form snapshot over HTTP 200, with Hadiya absent until public admission.
