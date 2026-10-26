// SPDX-License-Identifier: GPL-3.0-or-later
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const operatorItems=(preparation,operators)=>preparation.visible.map(p=>{const b=p.build;return`<li><strong>${escape(operators[b.id]?.name??b.id)}</strong><p class="operator-build">E${b.elite} · Lv ${b.level} · S${p.skillNumber} ${b.skillRank>7?'M'+(b.skillRank-7):'Rank '+b.skillRank} · Potential ${b.potential} · Trust ${b.trust}%${b.module?' · Module Lv '+b.moduleLevel:''}</p><p class="help">Already deployed · facing ${escape(p.dir.toLowerCase())}</p></li>`;}).join('');
export function fixedStagePreparationHtml(preparation,operators){
 return `<h2>Stage-supplied squad</h2><p class="help">Your operators and builds are fixed for this stage. Additional operators will become available during battle.</p>
 <ul aria-label="Starting operators">${operatorItems(preparation,operators)}</ul>`;
}
export function presetStagePreparationHtml(preparation,operators){
 return `<section aria-label="Stage-supplied operators"><h2>Stage-supplied operator</h2><p class="help">This operator starts on the field with the build shown below, separately from your squad and support. Choose your other operators below.</p><ul>${operatorItems(preparation,operators)}</ul></section>`;
}
