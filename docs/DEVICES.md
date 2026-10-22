# Map devices: audit and plan

`npm run audit:arkpedia-devices` reads `arkpedia-data/source/data/stage-devices.json` and lists every built stage with a functional map device (fixed-squad operators are excluded).

Snapshot: **70 built stages** carry a functional device; **64 are public**. The engine currently models none of them as devices. That is a pre-existing gap, not introduced by the latest stage batch; the new 7-8/7-9 stages were moved to `testOnly` as soon as their Originium Altars were noticed.

## Most common devices

1. **EP14 Mechanics Controller** — 20 stages.
2. **Roadside Emergency Reserves** — 14.
3. **Londinium Secondary Defense Artillery** — 11.
4. **Static Roadblock** — 5.
5. **Tattered Pillar** — 4.
6. Turrets, Stun Generators, Detectors, Originium Ice Crystals, Originium Altars, …

`node tools/arkpedia/device-audit.mjs` prints the full per-stage list.

## Device layer

The stage file should carry `devices` (key, name, row, col, description) and the adapter should either:

- implement the reviewed device behaviour, or
- refuse the stage with a named reason.

That is stricter than today, so the rollout must be staged:

1. Add `devices` to newly built stage files and refuse any unhandled functional device.
2. Implement the highest-impact devices in order: artillery, EP14 controller, reserves, pillars, turrets, altar.
3. Keep the 64 existing public device stages as a known backlog until each device is reviewed; do not silently claim parity.
4. Add one engine test per device for range, cadence, friendly/enemy side effects and destruction.

The Originium Altar is the first target because 7-8/7-9/7-10 already depend on its pulse and are `testOnly`.
