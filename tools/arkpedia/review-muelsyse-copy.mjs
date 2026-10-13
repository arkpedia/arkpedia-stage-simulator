// SPDX-License-Identifier: GPL-3.0-or-later
// Actual app controls with the opt-in source controller; not public roster or stage-clear approval.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182.');
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/muelsyse-source/copy-browser/';
const ID = 'char_249_mlyss', TOKEN = 'token_10030_mlyss_wtrman', DONOR = 'char_208_melan';
const sdCommit = 'f75740242898f24cad3fd0f5ffd24a9d0868da69';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
// This historical injected fixture remains useful against source-only snapshots.
// A selectable Muelsyse must instead exercise the real public squad and adapter.
if (data.operators[ID]) {
  await import('./review-muelsyse-public.mjs');
  process.exit(0);
}
assert.equal(data.operators[ID], undefined);
const manifest = JSON.parse(await readFile('../arkpedia-sd-assets/manifest.json', 'utf8'));
const models = Object.fromEntries(Object.entries(manifest.models).filter(([k]) =>
  [ID, TOKEN].some(id => k.startsWith(`operator/${id}/default/`))));
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
const {selectedMuelsyseBuild} = await import('/sim/content/arkpedia-muelsyse.js');
const {prepareMuelsyseFormSkills,MUELSYSE_FORM_SKILL_CONTRACT} = await import('/sim/content/arkpedia-muelsyse-form-skills.js');
const {normalizeChess} = await import('/sim/simdata.js');
const copyEvidence = await (await fetch('/data/arkpedia-muelsyse-prefabs.json')).json();
globalThis.muelsyseCopyReview = {
 get battle(){return battle;},get renderer(){return renderer;},
 get state(){return{selected,pending,copyActive:!!copyFlow?.active};},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 until(condition){paused=true;const end=battle.time+110;
  const reached=()=>condition==='ready'?this.token.skill.ready:!this.token.skill.active;
  for(let n=0;n<Math.ceil(110/battle.dt)&&!reached()&&battle.time<end;n++)battle.step();
  if(!reached())throw Error('Missing '+condition+' at '+battle.time+'; finished='+battle.finished+'; '+battle.reason);
  this.render();
 },
 async setup(){
  battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  const c=copyEvidence.tables.character,build={id:'${ID}',elite:2,level:90,potential:1,trust:0,skillRank:10,skillId:'skchr_mlyss_1'};
  const r=selectedMuelsyseBuild(build);
  // Non-enumerable diagnostic labels cannot enter catalogue/roster validation.
  Object.defineProperty(data.operators,'${ID}',{value:{...c,id:'${ID}',rarity:6,
   skills:c.skills.map(s=>({id:s.skillId,...copyEvidence.tables.skills[s.skillId]}))},enumerable:false});
  const raw={chessId:'${ID}',charId:'${ID}',name:c.name,profession:c.profession,position:c.position,
   subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
   skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:[],trigger:{rule:'NEVER'}},arkpedia:build};
  battle.data.raw.chess['${ID}']=raw;
  const u=battle._makeAlly(battle.getPlayer('arkpedia'),normalizeChess(raw),'op',3,4,{dir:'RIGHT'});
  const prepared=prepareMuelsyseFormSkills(battle,u,{contract:MUELSYSE_FORM_SKILL_CONTRACT});
  battle._setupUnit(u,prepared.kit);prepared.controller.install();
  battle.bench['${ID}']={build,unit:u,readyAt:0,deployments:0};
  if(!battle._deploy(u,{initial:false}))throw Error('Owner did not deploy');
  this.owner=u;this.deck=prepared.deck;
  data.sd.models={...data.sd.models,...${JSON.stringify(models)}};data.sd.commit='${sdCommit}';data.sd.localBase='/arkpedia-assets/${sdCommit}/';
  data.tokens['${TOKEN}']={avatar:${JSON.stringify(models[`operator/${TOKEN}/default/front`].avatar)},skills:[]};
  await renderer.preload([...Object.keys(battle.bench),'${TOKEN}']);
  this.token=prepared.deck.place(3,5);this.advance(1.1);
  selected=summonUnitId(this.token);this.render();
  const label=document.createElement('div');label.textContent='CONTROLLED COPY REVIEW · source diagnostic · extended review clock · no public roster / stage-clear approval';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);
 },
 focus(){selected=summonUnitId(this.token);pending=null;this.render();},
 snapshot(){return{dp:battle.dp,slots:battle.deployedSlots(),donorAlive:!!battle.bench['${DONOR}'].unit?.alive,
  copy:this.deck.point.copy,dir:this.token.dir,skillActive:this.token.skill.active,errors:battle.errors,...this.state};}
};`;
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failures = []; let currentPage;
try {
  for (const mobile of [false, true]) {
    const label = mobile ? 'landscape-phone' : 'desktop', page = await browser.newPage();
    currentPage = page;
    page.on('pageerror', e => errors.push({ label, message: e.message }));
    page.on('response', r => { if (r.status() >= 400) failures.push({ label, url: r.url(), status: r.status() }); });
    await page.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', async r => {
      const url = new URL(r.url());
      if (url.pathname === '/favicon.ico') return r.respond({ status: 204 });
      if (r.url().startsWith(origin) && url.pathname === '/arkpedia/app.js') return r.respond({ status: 200, contentType: 'text/javascript', body: app + hook });
      if (r.url().startsWith(origin) && url.pathname === '/data/arkpedia-mvp.json') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      if (r.url().startsWith(origin) && url.pathname.startsWith('/arkpedia-assets/' + sdCommit + '/')) {
        const path = url.pathname.split('/').slice(3).join('/');
        return r.respond({ status: 200, contentType: path.endsWith('.png') ? 'image/png' : 'application/octet-stream', body: await readFile('../arkpedia-sd-assets/' + path) });
      }
      return r.continue();
    });
    await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.roster-item.chosen');
    assert.equal(await page.$(`.roster-item[data-id="${ID}"]`), null);
    for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
    }
    for (const id of [DONOR, 'char_103_angel']) {
      await page.$eval('#roster-search', (e, name) => { e.value = name; e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[id].name);
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
    }
    await page.click('#start');
    await page.waitForFunction(() => window.muelsyseCopyReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
    await page.evaluate(() => muelsyseCopyReview.setup());
    console.log(label + ': source controller installed');
    async function press(selector) {
      const e = await page.$(selector); assert.ok(e, selector);
      await e.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      const p = await e.boundingBox(); assert.ok(p, selector);
      if (mobile) await page.touchscreen.tap(p.x + p.width / 2, p.y + p.height / 2); else await page.click(selector);
    }
    async function gesture(dir, confirm = true) {
      const h = await (await page.$('.facing-handle')).boundingBox(), x = h.x + h.width / 2, y = h.y + h.height / 2;
      if (mobile) await page.touchscreen.touchStart(x, y); else { await page.mouse.move(x, y); await page.mouse.down(); }
      const dx = dir === 'RIGHT' ? 65 : dir === 'LEFT' ? -65 : 0, dy = dir === 'UP' ? -65 : dir === 'DOWN' ? 65 : 0;
      if (mobile) await page.touchscreen.touchMove(x + dx, y + dy); else await page.mouse.move(x + dx, y + dy, { steps: 10 });
      assert.equal(await page.evaluate(() => muelsyseCopyReview.token.skill.active), true);
      if (!confirm) {
        if (mobile) await page.touchscreen.touchMove(x, y); else await page.mouse.move(x, y);
      }
      if (mobile) await page.touchscreen.touchEnd(); else await page.mouse.up();
    }
    const before = await page.evaluate(() => { muelsyseCopyReview.until('ready'); muelsyseCopyReview.battle.getPlayer('arkpedia').dp = 0; muelsyseCopyReview.render(); return muelsyseCopyReview.snapshot(); });
    await press('#skill');
    assert.equal(await page.$eval(`#deployment [data-id="${DONOR}"]`, e => e.classList.contains('copy-eligible')), true);
    assert.equal(await page.$eval('#command', e => e.textContent.includes('donor stays')), true);
    await page.screenshot({ path: out + label + '-choose-donor.png' });
    await press(`#deployment [data-id="${DONOR}"]`);
    assert.equal(await page.$eval('[data-facing="RIGHT"]', e => e.getAttribute('aria-label')), 'Copy facing right');
    await gesture('RIGHT', false);
    assert.equal(await page.evaluate(() => muelsyseCopyReview.state.pending.dir), null);
    assert.equal(await page.evaluate(() => muelsyseCopyReview.token.skill.active), true);
    await page.screenshot({ path: out + label + '-facing.png' });
    await gesture(mobile ? 'UP' : 'LEFT');
    const copied = await page.evaluate(() => muelsyseCopyReview.snapshot());
    console.log(label + ': copy confirmed');
    assert.equal(copied.copy.donorId, DONOR); assert.equal(copied.dir, mobile ? 'UP' : 'LEFT');
    assert.equal(copied.dp, before.dp); assert.equal(copied.slots, before.slots); assert.equal(copied.donorAlive, false);
    assert.equal(copied.copyActive, false); assert.equal(copied.pending, null); assert.deepEqual(copied.errors, []);
    await page.evaluate(() => { muelsyseCopyReview.advance(1); muelsyseCopyReview.until('ready'); });
    console.log(label + ': natural recharge complete');
    await press('#skill'); await press(`#deployment [data-id="${DONOR}"]`);
    if (mobile) {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.waitForSelector('#orientation-gate:not([hidden])');
      assert.equal(await page.evaluate(() => muelsyseCopyReview.token.skill.active), false);
      await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
      await page.waitForSelector('#orientation-gate[hidden]');
    } else await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => muelsyseCopyReview.state.copyActive), false);
    await page.evaluate(() => { muelsyseCopyReview.focus(); muelsyseCopyReview.until('ready'); });
    await press('#skill'); await press(`#deployment [data-id="${DONOR}"]`);
    await page.evaluate(() => muelsyseCopyReview.until('expired'));
    assert.equal(await page.evaluate(() => muelsyseCopyReview.state.pending), null);
    assert.equal(await page.$eval(`#deployment [data-id="${DONOR}"]`, e => e.classList.contains('copy-eligible')), false);
    await page.evaluate(() => { muelsyseCopyReview.until('ready'); muelsyseCopyReview.focus(); });
    if (!mobile) {
      await press('#skill'); await press('#deployment [data-id="char_103_angel"]');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => muelsyseCopyReview.token.dir), 'DOWN');
      assert.equal(await page.evaluate(() => muelsyseCopyReview.deck.point.copy.donorId), 'char_103_angel');
      await page.evaluate(() => muelsyseCopyReview.until('ready'));
    }
    await press('#skill'); await press(`#deployment [data-id="${DONOR}"]`);
    await page.evaluate(() => { const q = muelsyseCopyReview; q.deck.rest(q.deck.point); q.render(); });
    assert.equal(await page.evaluate(() => muelsyseCopyReview.state.pending), null);
    // Ordinary donor deployment remains available once copying is closed.
    await page.evaluate(() => { muelsyseCopyReview.battle.getPlayer('arkpedia').dp = 99; muelsyseCopyReview.render(); });
    await press(`#deployment [data-id="${DONOR}"]`);
    await press('[aria-label="Ground tile, row 3, column 6"]');
    await press('[data-facing="RIGHT"]');
    assert.equal(await page.evaluate(() => muelsyseCopyReview.battle.bench['char_208_melan'].unit?.alive), true);
    await page.screenshot({ path: out + label + '-normal-deployment.png' });
    reports.push({ label, copied, final: await page.evaluate(() => muelsyseCopyReview.snapshot()), cases: ['donor selection at zero DP', 'drop then swipe', 'centre cancellation', 'confirm once', 'Escape/rotation', 'expiry', 'recovery interruption', 'ordinary deployment', ...(!mobile ? ['keyboard facing/confirm'] : [])] });
    await page.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile(out + 'report.json', JSON.stringify({ publicRosterApproval: false, stageVictoryTest: false, sdCommit, reports, errors, failures }, null, 2) + '\n');
  console.log(JSON.stringify({ viewports: reports.length, cases: reports.map(r => r.cases), errors, failures }));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: out + 'failure.png' });
    console.error({ errors, failures, ...(await currentPage.evaluate(() => ({ state: muelsyseCopyReview.snapshot(), message: document.querySelector('#battle-message')?.textContent }))) });
  }
  throw error;
} finally { await browser.close(); }
