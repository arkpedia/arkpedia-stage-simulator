// SPDX-License-Identifier: GPL-3.0-or-later
// Keep command nodes stable while SP and queue counts change, including focus
// after activation. The battle remains the authority for command admission.
export function drawStageCommands(root, battle, { inactive = false, onAction = () => {} } = {}) {
  if (root.stageBattle !== battle) { root.replaceChildren(); root.stageBattle = battle; }
  const actions = battle.stageDeviceActions ?? new Map();
  root.hidden = actions.size === 0;
  for (const [id, { name, owner, state }] of actions) {
    let button = [...root.children].find(node => node.dataset.stageDevice === id);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.dataset.stageDevice = id;
      const label = document.createElement('span'), action = document.createElement('strong'), detail = document.createElement('small');
      label.className = 'stage-device-name'; action.className = 'stage-device-order'; detail.className = 'stage-device-detail';
      label.textContent = name;
      button.append(label, action, detail);
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-disabled') === 'true') return;
        battle.activateStageDevice(id); onAction();
      });
      root.append(button);
    }
    const command = state.mode === 0 ? 'Advance' : 'Standby';
    const sp = Math.min(state.spCost, Math.floor(state.sp + 1e-9));
    button.querySelector('.stage-device-order').textContent = command;
    button.querySelector('.stage-device-detail').textContent = `${state.waiting} waiting · ${state.total} on field · ${sp}/${state.spCost} SP`;
    button.setAttribute('aria-label', `${name}: ${command} miners, ${state.waiting} waiting, ${state.total} on field, ${sp} of ${state.spCost} SP`);
    button.setAttribute('aria-pressed', String(state.mode === 1));
    button.setAttribute('aria-disabled', String(inactive || battle.finished || !state.canActivate()));
    button.hidden = !owner.alive;
  }
}
