# Crackborne source and runtime review

Crackborne (`char_4225_tanya`) now runs through the normal squad/support path. The preview contains 388 frozen source forms and 846 skills, with 43 forms remaining in the pinned source target. This is source coverage, not an original-game fidelity claim.

The 236,082-byte foundation has SHA-256 `03e393621ac50e478e6816846c0fbb9b3d0dc5409e4914d7ec483fc1858c967c`, pinned to CN commit `a550f5e048bb94e7cdefc6eb97a4091f0c4c7add`, client `26-09-22-07-47-20_6c71fa`. Five bundles retain 62 owner/skill components and six transitive templates, with no unresolved template, referenced projectile or token graph. Source audits reproduce seven outputs and reject 28 altered claims on Node 22 and 24.

S1 attaches maximum HP and fixed self elemental recovery immediately at activation, because its native wait-for-casting flag is zero. Its twenty-second world-time account includes the original 0.4-second Begin. Recovery respects heal-free and elemental burst lock. The original 0.266667-second End preserves positive ordinary cooldown. Ordinary attacks select one target, including while blocking three.

S2 grants five capped permanent DEF stacks at the original Skill_2 marker. Its fixed-time ability opts into native slow-down, independently of ASPD. Each positive accepted HP loss consumes one stack before applying current-ATK erosion injury to legal ground recipients in the source nine cells. Fully absorbed, cancelled, dodged or floored HP changes and gauge receipts consume none; HP drain does. Fatal accepted damage can react before shared death bookkeeping. S2 does not fabricate an ordinary attack receipt.

The talent combines general and WATER operands before one-minus scaling for erosion. Typed protection shares the existing strongest-source channel, preserves weaker live producers as fallback, and applies unrelated intake multipliers once. Existing medic/protection regressions are included.

505 source, clock, resource, combat, public, slow-down and adjacent checks pass on both Node 22 and 24. The controller retains both ordinary clips, literal S1 mode tracks and the one-shot S2. Deterministic alternation of the native multi-ability choice, HP-modifier reaction order, source nonstackable-channel identity, expiry-frame dispatch and FSM/cooldown conversion remain explicit local mappings rather than certified compiled-game behavior.

Original artwork audits preserve all six raw files and decoded pixels/PMA, rejecting 33 altered claims on each Node version. Nineteen clips per viewport render in twenty desktop/emulated-phone captures without browser or resource errors. The separate SD review does not approve combat.

Modules, native particles/shaders/audio, physical-device behavior and original game-frame/pixel parity remain unverified. Arkpedia app dev and production remain untouched.

The SD metadata is merged through PR 28 at `47ce24294dbd274f41c614276720477f60826977`; the tested, proposed and final tree is `0f75517a7ee1386dd21701be0140074dc6a61599`. Only two Crackborne metadata rows changed; all six raw inputs and the other 3,011 models remain unchanged.

All thirty public checks pass on Node 22 and 24, covering all twenty skill ranks, promotion/potential/trust, maxed support, natural SP, manual activation, retreat/redeployment and original waves. S1 and S2 each clear original 0-1 with natural DP, unchanged terrain and Melantha: eleven kills, zero leaks and full life. Crackborne contributes ten attributed damage receipts/one activation for S1 and nineteen/two for S2.

Candidate browser review passes eight cases and fifty-six captures, with zero browser/resource errors: desktop mouse and emulated landscape-phone touch, both skills, Front and Back, public squad/skill choice, separate drag/drop/direction swipe, natural SP, activation, original clips, S1 HP/recovery, S2 DEF and HP-loss response, natural finish and retreat cleanup. The labelled fixture uses original terrain, empty waves, 99 DP, two pinned nonattacking targets and one explicit injected HP-loss receipt; original waves are covered separately. Desktop S1 Back and mobile S2 Front gameplay captures were inspected. Normal-preview replay and full local/hosted suites are separate checks.

All 887 reviewed model inputs verify. After removing only Crackborne's operator/source-channel/two models and normalizing the SD revision, the prior 387 operators, 885 models, tokens, source pins, default squad, stage, enemies and paths match exactly.
