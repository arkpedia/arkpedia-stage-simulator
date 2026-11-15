// SPDX-License-Identifier: GPL-3.0-or-later
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

export function createDamagePanel(host, names) {
  const panel = document.createElement('section');
  panel.className = 'damage-panel';
  panel.id = 'damage-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Operator damage');
  panel.innerHTML = `<header><h2>Operator damage</h2><button type="button" aria-label="Close damage panel">×</button></header>
    <p>Enemy HP removed · summons count toward their operator.<br>DPS: last 5 seconds of battle time. Pausing freezes the readout.</p>
    <div class="damage-scroll" tabindex="0" role="region" aria-label="Damage breakdown"><table>
    <thead><tr><th scope="col">Operator</th><th scope="col">Total</th><th scope="col">DPS (5s)</th><th scope="col">Physical</th><th scope="col">Arts</th><th scope="col">Elemental</th><th scope="col">True</th></tr></thead><tbody></tbody></table></div>`;
  host.append(panel);
  let opener;
  const close = () => {
    panel.hidden = true;
    opener?.setAttribute('aria-expanded', 'false');
    if (opener?.isConnected) opener.focus();
  };
  panel.querySelector('button').onclick = close;
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    // Space scrolls this table; it must not toggle battle playback.
    if (event.code === 'Space') event.stopPropagation();
  });
  const elements = new Map();
  return {
    toggle(button) {
      if (!panel.hidden) { close(); return; }
      opener = button;
      button.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      panel.querySelector('button').focus();
    },
    update(rows) {
      if (panel.hidden) return;
      const body = panel.querySelector('tbody');
      for (const row of rows) {
        let tr = elements.get(row.id);
        if (!tr) {
          tr = document.createElement('tr');
          tr.innerHTML = '<th scope="row"></th>' + '<td></td>'.repeat(6);
          elements.set(row.id, tr);
        }
        const values = [names[row.id] ?? row.id, row.total, row.dps,
          row.types.phys, row.types.arts, row.types.elemental, row.types.true];
        values.forEach((value, index) => {
          tr.children[index].textContent = index ? number.format(value) : value;
        });
        body.append(tr);
      }
    },
    close,
  };
}
