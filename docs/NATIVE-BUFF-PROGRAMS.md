# Native buff programs

Reviewed native templates now compile to bounded JSON graphs. The common `compileBuffTemplate` frontend accepts a build-time dialect; its existing operator behavior remains the default. `behavior-native-compiler.js` handles native source fields and emits portable programs. Browsers load only `behavior-program.js` with the selected enemy adapter. Neither native templates nor source compilation join browser startup.

The first dialect covers `CheckContainsBuff`, `CheckAbnormalFlag` for silence, `CheckTargetProfession`, sequential predicates with `IfNot`, nested `IfElse`, `ReleaseFromBlocker`, immediate child buffs, limited EXTEND child buffs and the reviewed fixed sourced HP-loss form of `FixedValueDamage`. Unknown fields, unsupported flags, inactive unsupported branches and cyclic/missing template references fail compilation. Graphs have at most 64 templates, 1024 nodes and depth 16, with at most 4096 expanded synchronous steps per event. Numeric blackboard operands validate before execution, including operands in inactive branches. Prepared immutable snapshots are reused across spawned parameter copies.

Owner, source and event target stay distinct. A child periodic buff owns its existing simulator clock; it does not create a scheduler callback for each pulse. Refresh retains the same buff and clock. Source death does not erase an attached loss effect. Fixed TARGET loss follows the event target and retains source attribution. Immediate child release uses its new owner. Child graphs refer to template keys once instead of embedding repeated copies.

Gnawbeasts now feed their accepted charged hit into a program: silence and profession predicates select the modifier target, then a shared child template performs the five pulses. Charge selection, physical damage and accepted-hit checks remain shared transport. Zealous Extras run their program on the independently owned blocker-side clock. The acquisition rule remains a separate shared block condition. Old pinned plans using `chargedMeleePeriodicLoss` or the original paired-marker parameters remain executable.

## Adding a mechanic atomically

1. Retain the source template and referenced children with the existing native extraction workflow. Run `npm run content:buff-programs` to see the first compiler blocker and its retained source consumers.
2. If existing nodes express the mechanic, compile its entry template with `compileNativeBuffProgram(entry, templateFor)`. Keep values in the ability blackboard. Attach the graph as `params.program` to a reviewed transport. Do not copy an interpreter or paste child programs into each variant.
3. Keep a strict source admission gate for the complete native wrapper, clock, targeting and bindings. Successful template compilation alone never admits an enemy or environment. If a node is missing, add its explicit source contract and portable opcode with negative and runtime tests before using it.
4. Regenerate enemy support, runtime plans, stage library and inventory. Stage packing automatically moves `params.program` into the existing content-addressed component store. Selected loading hydrates `programComponent` references, deduplicates concurrent requests and retries failed loads. Distinct variant blackboards remain in their enemy definitions. Runtime preparation refuses invalid or unhydrated programs before battle construction; application preflights later programs before earlier traits mutate combat.
5. Run the affected family tests, loader/preflight tests and available-stage smoke. Inspect selected desktop/touch loading and record the limits of the source evidence.

The audit covers retained templates and prefabs, not the entire game corpus. Its refusal groups report only the first blocker per template, and shared child consumers propagate transitively. It records hashes and operand names without publishing another global program payload.

## Initial review limits

Native particle effects are not executed by these programs. Override-effect keys are accepted presentation metadata. Exact Unity callback/frame ordering, arbitrary source inheritance combinations, general damage modifiers, derived buffs, summons, environment controllers and full-run progression remain outside this dialect. Adding an opcode requires a reviewed semantic contract; allowing an event name does not wire that event to every transport.
