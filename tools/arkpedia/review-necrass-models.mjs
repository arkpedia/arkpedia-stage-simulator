// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated native-art review, separate from playable-roster or combat approval.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start the port-3182 preview.');
const origin = 'http://127.0.0.1:3182', path = '/arkpedia/necrass-art-review.html';
const root = '.cache/arkpedia/necrass-source/device-art/', out = root + 'browser/';
const receipt = JSON.parse(await readFile('data/arkpedia-necrass-device-art.json', 'utf8'));
const manifest = JSON.parse(await readFile('../arkpedia-sd-assets/manifest.json', 'utf8'));
const rows = ['front', 'back'].map(face => {
  const id = 'char_450_necras', r = manifest.models[`operator/${id}/default/${face}`];
  const files = Object.fromEntries([r.skeleton, r.atlas, ...r.textures].map(f => [f.path.split('/').at(-1), '../arkpedia-sd-assets/' + f.path]));
  return { id, face, r: { durations: r.animations, animationRoles: r.animationRoles }, files,
    hashes: [r.skeleton, r.atlas, ...r.textures].map(({ path, sha256 }) => ({ path, sha256 })) };
});
for (const [id, model] of Object.entries(receipt.models)) for (const [face,r] of Object.entries(model.facings)) rows.push({ id, face, r,
  files: Object.fromEntries(Object.keys(r.files).filter(f => f !== 'avatar.png').map(f => [f, root + r.directory + '/' + f])),
  hashes: Object.entries(r.files).map(([name, { sha256 }]) => ({ path: r.directory + '/' + name, sha256 })) });
await mkdir(out, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Necrass and Servant original artwork review</title>
<script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script>
<style>body{margin:0;background:#10191d;color:#dae9ed;font:14px sans-serif}header{padding:12px}#scene{height:calc(100dvh - 52px)}canvas{display:block}</style>
<header>CONTROLLED ART REVIEW · Necrass and Servant Front / Back · not a battle</header><div id="scene"></div>
<script>
(async()=>{
 const P=PIXI,rows=${JSON.stringify(rows.map(({ files, ...r }) => ({ ...r, names: Object.keys(files) })))},host=document.querySelector('#scene');
 const app=new P.Application({width:innerWidth,height:host.clientHeight,backgroundColor:0x10191d,autoStart:false,antialias:true});host.append(app.view);
 const actors=[];
 for(const [i,a] of rows.entries()){
  const skel=a.names.find(k=>k.endsWith('.skel')),atlas=a.names.find(k=>k.endsWith('.atlas')),prefix='/necrass-review-assets/'+i+'/';
  const loaded=await P.Assets.load({src:prefix+skel,data:{spineAtlasFile:prefix+atlas,imageMetadata:{alphaMode:P.ALPHA_MODES.PMA}}});
  const s=new P.spine.Spine(loaded.spineData);s.autoUpdate=false;app.stage.addChild(s);
  const label=new P.Text('',{fontFamily:'sans-serif',fontSize:14,fill:0xdbeaed});label.anchor.set(.5);app.stage.addChild(label);
  actors.push({...a,s,label});
 }
 function clipFor(a,phase){
  const owner=a.id==='char_450_necras';
  const clips={
   normalIdle:owner?'Idle':'Idle_2',dragonIdle:'Idle',normalBorn:owner?'Start':'Start_2',dragonBorn:'Start',
   normalAttack:owner?'Attack':'Attack_2',dragonAttack:'Attack',resummon:owner?'Skill_1':'Idle_2',
   linkBegin:owner?'Skill_2_Begin':'Idle_2',linkLoop:owner?'Skill_2_Loop':'Idle_2',linkEnd:owner?'Skill_2_End':'Idle_2',
   volleyBegin:owner?'Skill_3_Begin':'Skill_Begin',volleyLoop:owner?'Skill_3_Loop':'Skill_Loop',volleyEnd:owner?'Skill_3_End':'Skill_End',
   downBegin:owner?'Idle':'Skill_Down_Begin',downLoop:owner?'Idle':'Skill_Down_Loop',downEnd:owner?'Idle':'Skill_Down_End',
   normalDie:owner?'Die':'Die_2',dragonDie:'Die',normalStun:owner?'Idle':'Stun_2',dragonStun:owner?'Idle':'Stun'
  };
  const clip=clips[phase]??phase;return a.r.durations[clip]==null?null:clip;
 }
 function draw(phase='normalIdle',age=.35){
  app.renderer.resize(innerWidth,host.clientHeight);const w=innerWidth/actors.length,h=host.clientHeight;
  return actors.map((a,i)=>{
   const clip=clipFor(a,phase);a.s.visible=clip!=null;
   a.label.text=(a.id==='char_450_necras'?'Necrass':'Servant')+' · '+a.face+' · '+(clip??'absent native clip');a.label.position.set((i+.5)*w,h-28);
   if(clip==null)return {id:a.id,face:a.face,clip,age,absent:true};
   a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,clip,phase==='Idle');a.s.scale.set(1);a.s.position.set(0);a.s.update(age);
   const b=a.s.getLocalBounds();
   const scale=Math.min((w-48)/b.width,(h-60)/b.height);
   a.s.scale.set(scale);a.s.position.set((i+.5)*w-(b.x+b.width/2)*scale,(h-28)/2-(b.y+b.height/2)*scale);
   return {id:a.id,face:a.face,clip,age,width:b.width,height:b.height,scale};
  });
 }
 window.necrassArtReview={actors,app,draw,ready:true};draw();app.renderer.render(app.stage);
})().catch(e=>{window.reviewError=e.stack;console.error(e)});
</script>`;
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], failed = [], report = { artworkOnly: true, publicBattleTest: false, sources: rows.map(({ id, face, hashes }) => ({ id, face, hashes })), captures: [], clips: [] };
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
  await page.setRequestInterception(true);
  page.on('request', async r => {
    const url = new URL(r.url());
    if (url.pathname === path) return r.respond({ status: 200, contentType: 'text/html', body: html });
    if (url.pathname === '/favicon.ico') return r.respond({ status: 204 });
    const match = /^\/necrass-review-assets\/(\d+)\/([^/]+)$/.exec(url.pathname);
    const file = match && rows[Number(match[1])]?.files[match[2]];
    if (file) return r.respond({ status: 200, contentType: file.endsWith('.png') ? 'image/png' : file.endsWith('.atlas') ? 'text/plain' : 'application/octet-stream', body: await readFile(file) });
    return r.continue();
  });
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.necrassArtReview?.ready || window.reviewError, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.reviewError), undefined);
  report.clips = await page.evaluate(() => necrassArtReview.actors.flatMap(a => a.s.spineData.animations.filter(c => c.name !== 'Default').map(c => {
    a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,c.name,false);a.s.update(Math.min(.5,c.duration/2));
    const b=a.s.getLocalBounds();return {id:a.id,face:a.face,clip:c.name,duration:c.duration,width:b.width,height:b.height};
  })));
  assert.equal(report.clips.length, rows.reduce((n,a)=>n+Object.keys(a.r.durations).filter(k=>k!=='Default').length,0));
  await writeFile(out + 'clip-review.json', JSON.stringify(report.clips, null, 2) + '\n');
  assert.ok(report.clips.every(c => c.width > 0 && c.height > 0 && Number.isFinite(c.width + c.height)));
  for (const [name, width, height] of [['desktop', 1280, 720], ['landscape-phone', 844, 390]]) {
    await page.setViewport({ width, height });
    for (const phase of ['normalIdle','dragonIdle','normalBorn','dragonBorn','normalAttack','dragonAttack','resummon','linkBegin','linkLoop','linkEnd','volleyBegin','volleyLoop','volleyEnd','downBegin','downLoop','downEnd','normalDie','dragonDie','normalStun','dragonStun']) {
      const states = await page.evaluate(phase => { const r = necrassArtReview.draw(phase);necrassArtReview.app.renderer.render(necrassArtReview.app.stage);return r; }, phase);
      assert.ok(states.every(s => s.absent || s.scale > 0 && Number.isFinite(s.scale)));
      const file = out + name + '-' + phase.toLowerCase() + '.png';await page.screenshot({ path: file });
      report.captures.push({ name, width, height, phase, file, states });
    }
  }
  assert.deepEqual(errors, []);assert.deepEqual(failed, []);
  await writeFile(out + 'report.json', JSON.stringify({ ...report, errors, failed }, null, 2) + '\n');
  console.log(JSON.stringify({ clips: report.clips.length, captures: report.captures.length, errors, failed }));
} finally { await browser.close(); }
