// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public roster/deployment/copy UI: empty waves, 99 DP, extended review clock; natural SP.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182.');
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/muelsyse-source/public-browser/';
const ID = 'char_249_mlyss', TOKEN = 'token_10030_mlyss_wtrman', DONOR = 'char_208_melan';
const sdCommit = 'f75740242898f24cad3fd0f5ffd24a9d0868da69';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]);
assert.equal(data.sd.commit,sdCommit);
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
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
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;this.render();},
 attach(){this.owner=battle.bench['${ID}'].unit;this.deck=this.owner.mem.muelsyseController.devices;this.token=this.deck.point.unit;
  this.advance(1.1);selected=summonUnitId(this.token);this.render();
  const label=document.createElement('div');label.textContent='CONTROLLED PUBLIC UI · empty waves / 99 DP / extended clock / natural SP';
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
  for (const skill of [1,2,3]) for (const mobile of [false, true]) {
    const label = `s${skill}-` + (mobile ? 'landscape-phone' : 'desktop'), page = await browser.newPage();
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
      return r.continue();
    });
    await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.roster-item.chosen');
    assert.ok(await page.$(`.roster-item[data-id="${ID}"]`));
    for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
    }
    for (const id of [ID,DONOR, 'char_103_angel']) {
      await page.$eval('#roster-search', (e, name) => { e.value = name; e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[id].name);
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
      if(id===ID) await page.select('#skillId',`skchr_mlyss_${skill}`);
    }
    await page.click('#start');
    await page.waitForFunction(() => window.muelsyseCopyReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
    await page.evaluate(() => muelsyseCopyReview.setup());
    console.log(label + ': public squad created');
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
    await press(`#deployment [data-id="${ID}"]`);
    await press('[aria-label="Raised tile, row 5, column 5"]');
    await press('[data-facing="RIGHT"]');
    assert.equal(await page.evaluate(()=>muelsyseCopyReview.battle.bench['char_249_mlyss'].unit?.alive),true);
    await press('#deployment [data-id="summon:char_249_mlyss"]');
    await press('[aria-label="Ground tile, row 4, column 6"]');
    await page.evaluate(()=>muelsyseCopyReview.attach());
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
    const rendered = await page.evaluate(() => {
      const q = muelsyseCopyReview; q.advance(1.1);
      return { key: q.renderer.views.get(q.token.id)?.key, visual: q.token.mem.regularFormVisual };
    });
    assert.equal(rendered.key, `operator/${TOKEN}/default/front`); // Native Single skeleton, aliased Front/Back.
    assert.equal(rendered.visual.clip, 'A_Idle');
    await page.screenshot({path:out+label+'-copied-form.png'});
    await page.evaluate(() => muelsyseCopyReview.until('ready'));

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
    await press(`#deployment [data-id="${ID}"]`);
    await page.evaluate(()=>{const q=muelsyseCopyReview;while(!q.owner.skill.ready)q.advance(q.battle.dt);});
    await press('#skill');
    assert.equal(await page.evaluate(()=>muelsyseCopyReview.owner.skill.active),true);
    await page.screenshot({path:out+label+'-owner-skill.png'});
    await page.evaluate(()=>muelsyseCopyReview.advance(16));
    await press('#retreat');
    assert.equal(await page.evaluate(()=>muelsyseCopyReview.deck.tokens.size),0);
    assert.equal(await page.evaluate(()=>muelsyseCopyReview.owner.mem.muelsyseController.stopped),true);
    reports.push({ label, copied, final: await page.evaluate(() => ({errors:muelsyseCopyReview.battle.errors,stopped:muelsyseCopyReview.owner.mem.muelsyseController.stopped})), cases: ['donor selection at zero DP', 'drop then swipe', 'centre cancellation', 'confirm once', 'Escape/rotation', 'expiry', 'recovery interruption', 'ordinary deployment', 'original copied-form facing', 'public owner skill/retreat', ...(!mobile ? ['keyboard facing/confirm'] : [])] });
    await page.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile(out + 'report.json', JSON.stringify({ publicRosterApproval: true, stageVictoryTest: false, controlled: true, sdCommit, reports, errors, failures }, null, 2) + '\n');
  console.log(JSON.stringify({ viewports: reports.length, cases: reports.map(r => r.cases), errors, failures }));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: out + 'failure.png' });
    console.error(error); console.error({ errors, failures, ...(await currentPage.evaluate(() => ({ state: muelsyseCopyReview.state, message: document.querySelector('#battle-message')?.textContent, tiles:[...document.querySelectorAll('#tile-buttons button')].map(x=>x.getAttribute('aria-label')) }))) });
  }
  throw error;
} finally { await browser.close(); }
