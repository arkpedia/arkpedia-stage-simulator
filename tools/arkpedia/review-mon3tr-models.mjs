// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated native-art review, separate from playable-roster or combat approval.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start the port-3182 preview.');
const origin = 'http://127.0.0.1:3182', path = '/arkpedia/mon3tr-art-review.html';
const root = '.cache/arkpedia/mon3tr-source/device-art/', out = root + 'browser/';
const manifest = JSON.parse(await readFile('../arkpedia-sd-assets/manifest.json', 'utf8'));
const rows = ['char_4179_monstr','token_10050_monstr_prosts'].flatMap(id => ['front','back'].map(face => {
  const r = manifest.models[`operator/${id}/default/${face}`];
  const files = Object.fromEntries([r.skeleton,r.atlas,...r.textures].map(f => [f.path.split('/').at(-1),'../arkpedia-sd-assets/'+f.path]));
  return {id,face,r:{durations:r.animations,animationRoles:r.animationRoles},files,
    hashes:[r.skeleton,r.atlas,...r.textures].map(({path,sha256})=>({path,sha256}))};
}));
await mkdir(out, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mon3tr and Reconstruction original artwork review</title>
<script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script>
<style>body{margin:0;background:#10191d;color:#dae9ed;font:14px sans-serif}header{padding:12px}#scene{height:calc(100dvh - 52px)}canvas{display:block}</style>
<header>CONTROLLED ART REVIEW · Mon3tr and Reconstruction Front / Back · not a battle</header><div id="scene"></div>
<script>
(async()=>{
 const P=PIXI,rows=${JSON.stringify(rows.map(({ files, ...r }) => ({ ...r, names: Object.keys(files) })))},host=document.querySelector('#scene');
 const app=new P.Application({width:innerWidth,height:host.clientHeight,backgroundColor:0x10191d,autoStart:false,antialias:true});host.append(app.view);
 const actors=[];
 for(const [i,a] of rows.entries()){
  const skel=a.names.find(k=>k.endsWith('.skel')),atlas=a.names.find(k=>k.endsWith('.atlas')),prefix='/mon3tr-review-assets/'+i+'/';
  const loaded=await P.Assets.load({src:prefix+skel,data:{spineAtlasFile:prefix+atlas,imageMetadata:{alphaMode:P.ALPHA_MODES.PMA}}});
  const s=new P.spine.Spine(loaded.spineData);s.autoUpdate=false;app.stage.addChild(s);
  const label=new P.Text('',{fontFamily:'sans-serif',fontSize:14,fill:0xdbeaed});label.anchor.set(.5);app.stage.addChild(label);
  actors.push({...a,s,label});
 }
 function clipFor(a,phase){
  if(a.id==='char_4179_monstr')return a.r.durations[phase]!=null?phase:null;
  return ['Start','Idle','Attack','Die','Skill_3_Begin','Skill_3'].includes(phase)?phase:'Idle';
 }
 function draw(phase='Idle',age=.35){
  app.renderer.resize(innerWidth,host.clientHeight);const columns=innerWidth<1000?2:actors.length,w=innerWidth/columns,h=host.clientHeight/Math.ceil(actors.length/columns);
  return actors.map((a,i)=>{
   const cx=(i%columns+.5)*w,top=Math.floor(i/columns)*h;
   const clip=clipFor(a,phase);a.s.visible=clip!=null;
   a.label.text=(a.id==='char_4179_monstr'?'Mon3tr':'Reconstruction')+' · '+a.face+' · '+(clip??'absent native clip');a.label.position.set(cx,top+h-28);
   if(clip==null)return {id:a.id,face:a.face,clip,age,absent:true};
   a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,clip,phase==='Idle');a.s.scale.set(1);a.s.position.set(0);a.s.update(age);
   const b=a.s.getLocalBounds();
   if(!(b.width>0&&b.height>0)){
    if(a.id!=='token_10050_monstr_prosts'||clip!=='Skill_3'||a.r.durations[clip]!==0)throw Error('Unexpected empty native pose: '+a.id+'/'+a.face+'/'+clip);
    a.s.visible=false;a.label.text+=' · authored empty pose';
    return {id:a.id,face:a.face,clip,age,width:b.width,height:b.height,authoredEmpty:true};
   }
   const scale=Math.min((w-48)/b.width,(h-60)/b.height);
   a.s.scale.set(scale);a.s.position.set(cx-(b.x+b.width/2)*scale,top+(h-28)/2-(b.y+b.height/2)*scale);
   return {id:a.id,face:a.face,clip,age,width:b.width,height:b.height,scale};
  });
 }
 window.mon3trArtReview={actors,app,draw,ready:true};draw();app.renderer.render(app.stage);
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
    const match = /^\/mon3tr-review-assets\/(\d+)\/([^/]+)$/.exec(url.pathname);
    const file = match && rows[Number(match[1])]?.files[match[2]];
    if (file) return r.respond({ status: 200, contentType: file.endsWith('.png') ? 'image/png' : file.endsWith('.atlas') ? 'text/plain' : 'application/octet-stream', body: await readFile(file) });
    return r.continue();
  });
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mon3trArtReview?.ready || window.reviewError, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.reviewError), undefined);
  report.clips = await page.evaluate(() => mon3trArtReview.actors.flatMap(a => a.s.spineData.animations.filter(c => c.name !== 'Default').map(c => {
    a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,c.name,false);a.s.update(Math.min(.5,c.duration/2));
    const b=a.s.getLocalBounds();return {id:a.id,face:a.face,clip:c.name,duration:c.duration,width:b.width,height:b.height};
  })));
  assert.equal(report.clips.length, rows.reduce((n,a)=>n+Object.keys(a.r.durations).filter(k=>k!=='Default').length,0));
  await writeFile(out + 'clip-review.json', JSON.stringify(report.clips, null, 2) + '\n');
  assert.ok(report.clips.every(c => Number.isFinite(c.width+c.height) && (c.width>0&&c.height>0 || c.id==='token_10050_monstr_prosts'&&c.clip==='Skill_3'&&c.duration===0)));
  for (const [name, width, height] of [['desktop', 1280, 720], ['landscape-phone', 844, 390]]) {
    await page.setViewport({ width, height });
    for (const phase of ['Start','Idle','Attack','Skill_1','Skill_2_Begin','Skill_2_Loop','Skill_2_Idle','Skill_2_End','Skill_3_Begin','Skill_3_Loop','Skill_3_Idle','Skill_3_End','Skill_3_Back','Skill_3_ReStart','Die','Skill_3']) {
      const states = await page.evaluate(phase => { const r = mon3trArtReview.draw(phase);mon3trArtReview.app.renderer.render(mon3trArtReview.app.stage);return r; }, phase);
      assert.ok(states.every(s => s.absent || s.authoredEmpty || s.scale > 0 && Number.isFinite(s.scale)));
      const file = out + name + '-' + phase.toLowerCase() + '.png';await page.screenshot({ path: file });
      report.captures.push({ name, width, height, phase, file, states });
    }
  }
  assert.deepEqual(errors, []);assert.deepEqual(failed, []);
  await writeFile(out + 'report.json', JSON.stringify({ ...report, errors, failed }, null, 2) + '\n');
  console.log(JSON.stringify({ clips: report.clips.length, captures: report.captures.length, errors, failed }));
} finally { await browser.close(); }
