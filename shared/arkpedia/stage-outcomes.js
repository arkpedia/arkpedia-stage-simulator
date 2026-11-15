// SPDX-License-Identifier: GPL-3.0-or-later
/** Presentation for reviewed native result counters. Add a descriptor alongside
 * a new outcome feature; the result panel does not need enemy-specific code. */
const OUTCOMES = Object.freeze([
  { key: 'prison', label: 'Prisoners reconfined', note: '' },
  { key: 'dsshell_overlapped', label: 'Deployments on Carapaces', note: '' },
  { key: 'locate_on_tile_mire', label: 'Allied entries onto Mire', note: '' },
  { key: 'trap_068_badbox', label: 'Chest Seaborns defeated', note: 'Recorded for the run.' },
  { key: 'trap_110_smbbox', label: 'Testaceous Vinecreeps defeated', note: 'Recorded for the run.' },
  { key: 'trap_757_skzbox', label: 'Treasure Chests opened',
    note: 'Run rewards are not applied by the stage simulator.' },
  { key: 'trap_759_skzwyx', label: 'Fowlbeasts rescued',
    note: 'Run rewards are not applied by the stage simulator.' },
  { key: 'trap_758_skzmbx', label: 'Lost Contraptions defeated',
    note: 'Run rewards are not applied by the stage simulator.' },
  { key: 'rogue_thief_reach_exit', label: 'Ingot theft events',
    note: 'The run applies the ingot loss after this stage.' },
  { key: 'killed', enemy: 'enemy_2091_skzgds', label: 'Windows defeated',
    note: 'Prosperity becomes available in the run after this stage.' },
  { key: 'killed', enemy: 'enemy_2070_skzfbx', label: 'Lost Hovercraft defeated',
    note: 'Run rewards are not applied by the stage simulator.' },
]);
export function stageOutcomeSummaries(outcomes) {
  const counters = OUTCOMES.flatMap(({ key, enemy, label, note }) => {
    const count = enemy ? (outcomes?.events ?? []).filter(event => event.key === key && event.enemy === enemy)
      .reduce((total, event) => total + event.value, 0) : outcomes?.counters?.[key] ?? 0;
    return count > 0 ? [`${label}: ${count}.${note ? ` ${note}` : ''}`] : [];
  });
  const removed = (outcomes?.events ?? []).filter(event => event.key === 'rogue_first_step')
    .map(event => event.operatorName ?? event.operator);
  const reeds = (outcomes?.tileStates ?? []).filter(t => t.key === 'tile_reed_mode');
  return [...counters, ...(removed.length ? [`Operators removed by Portal: ${removed.join(', ')}. Return timing belongs to the run.`] : []),
    ...(reeds.length ? [`Reeds at battle end: ${reeds.filter(t => t.value === 1).length} burning, ${reeds.filter(t => t.value === 2).length} cooling, ${reeds.filter(t => t.value === 0).length} unlit.`] : [])];
}
