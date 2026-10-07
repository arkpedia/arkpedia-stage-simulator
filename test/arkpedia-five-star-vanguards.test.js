// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-five-star-vanguard-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_VANGUARD_OPERATORS } from '../shared/arkpedia/five-star-vanguard-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
const Z='char_115_headbr',T='char_102_texas',C='char_349_chiave',P='char_488_buildr',R='char_261_sddrag';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function make(ids, overrides={}) {
  const d=structuredClone(data); d.stage.geometry.waves[0].spawns=[]; d.stage.battle.dp_per_second=0;
  const b=new StandardBattle(d,{operators:ids.map(id=>({...defaultBuild(d.operators[id]),...overrides[id]}))});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');return b;
}
function deploy(b,id,r=2,c=7){b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,r,c,'RIGHT');u.atkCd=1000;b.getPlayer('arkpedia').dp=0;return u;}
function tick(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);}
function enemy(b,x=8,y=2){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=e.hp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}

test('five vanguards retain original bundle/table hashes, selectors, clocks and all skill ranks',()=>{
  assert.equal(source.projectile.alwaysHitTraceTargetInTheEnd,1);
  for(const [id,config]of Object.entries(FIVE_STAR_VANGUARD_OPERATORS)){
    assert.match(source.sourceBundles.find(s=>s.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
    assert.ok(source.characters[id].length);assert.ok(source.models[id].Front.attackHit>0);
    for(const skillId of config.skillIds)for(let skillRank=1;skillRank<=10;skillRank++){
      const b=make([id],{[id]:{skillId,skillRank}}),u=deploy(b,id);
      assert.equal(u.skill.id,skillId);near(u.skill.spCost,u.def.skill.spCost);
      assert.equal(u.skill.noSkill,false);
    }
  }
});
test('Zima E2 squad discount includes bench Vanguards, never non-Vanguards or a double owner reduction',()=>{
  const b=make([Z,'char_123_fang','char_208_melan']);
  const alone=make(['char_123_fang','char_208_melan']);
  near(b.cost('char_123_fang'),alone.cost('char_123_fang')-1);
  near(b.cost('char_208_melan'),alone.cost('char_208_melan'));
  const zAlone=make([Z]);near(b.cost(Z),zAlone.cost(Z));
  const lower=make([Z,'char_123_fang'],{[Z]:{elite:1,level:70,skillRank:7}});
  near(lower.cost('char_123_fang'),alone.cost('char_123_fang'));
});
test('Texas initial DP is a squad talent rather than a deployment cost modifier, and resets once per battle',()=>{
  const plain=make(['char_123_fang']),b=make([T]);near(b.dp,plain.dp+2);
  const low=make([T],{[T]:{elite:0,level:50,skillRank:4}});near(low.dp,plain.dp);
  near(b.cost(T),b.data.getChess(T).stats.cost);
  deploy(b,T);near(b.dp,0);b.retreatOperator(T);const refunded=b.dp;
  tick(b,80);deploy(b,T);near(b.dp,0);assert.ok(refunded>0);
});
test('S1 charges produce exact12 DP and do not turn positive talent cost into operator cost',()=>{
  for(const id of [Z,T,C,P]){const b=make([id]),u=deploy(b,id);cast(b,u);near(b.dp,12);}
});
test('Zima S2 applies only to Vanguards including late deployments, adds kill DP and exactly12 periodic grants',()=>{
  const b=make([Z,'char_123_fang','char_208_melan'],{[Z]:{skillId:'skchr_headbr_2'}}),u=deploy(b,Z);
  const fang=deploy(b,'char_123_fang',2,6),mel=deploy(b,'char_208_melan',2,5),fatk=fang.s.atk,matk=mel.s.atk;
  cast(b,u);near(fang.s.atk,fatk*1.6);near(mel.s.atk,matk);
  const e=enemy(b);b.kill(e,fang);near(b.dp,1);
  const e2=enemy(b);b.kill(e2,mel);near(b.dp,1);
  tick(b,10);near(b.dp,13);near(fang.s.atk,fatk);near(mel.s.atk,matk);
});
test('Texas swords hit twice at original independent birth delays; stun and Arts mitigation apply',()=>{
  const b=make([T],{[T]:{skillId:'skchr_texas_2'}}),u=deploy(b,T),e=enemy(b,7,2);
  b.rng=()=>0;e.base.res=50;e.markDirty();cast(b,u);near(b.dp,12);
  tick(b,.6);near(e.hp,100000);
  tick(b,.15);near(100000-e.hp,u.s.atk*1.7*.5);assert.equal(e.s.flags.stun,true);
  tick(b,.8);near(100000-e.hp,u.s.atk*1.7*.5*2);
  tick(b,3.1);assert.equal(e.s.flags.stun,false);
});
test('Chiave robot count is live, stacks ATK/DEF and cuts robot redeploy only while present',()=>{
  const bot='char_285_medic2',b=make([C,bot]),u=deploy(b,C),atk=u.s.atk;
  const robot=deploy(b,bot,1,3);tick(b,.05);near(u.s.atk,atk*1.11);
  const start=b.time;b.retreatOperator(bot);near(b.bench[bot].readyAt-start,robot.base.respawnTime*.25);
  tick(b,.05);near(u.s.atk,atk);
  b.retreatOperator(C);tick(b,200);const again=deploy(b,bot,1,3),next=b.time;
  b.retreatOperator(bot);near(b.bench[bot].readyAt-next,again.base.respawnTime);
});
test('Chiave S2 is one Arts strike with source RES final scale and finite expiry',()=>{
  const b=make([C],{[C]:{skillId:'skchr_chiave_2'}}),u=deploy(b,C),e=enemy(b,7,2);
  e.base.res=50;e.markDirty();cast(b,u);near(b.dp,13);
  tick(b,.6);near(e.hp,100000);tick(b,.15);near(100000-e.hp,u.s.atk*3.5*.5);near(e.s.res,40);
  tick(b,8.1);near(e.s.res,50);
});
test('Texas and Chiave cannot start ordinary attacks or recover SP before their full original cast finishes',()=>{
  for(const [id,skillId]of [[T,'skchr_texas_2'],[C,'skchr_chiave_2']]){
    const b=make([id],{[id]:{skillId}}),u=deploy(b,id),e=enemy(b,8,2);
    let normalHits=0;b.on('damaged',({source,dmg})=>{if(source===u&&!dmg.isSkill)normalHits++;});
    u.atkCd=0;cast(b,u);
    tick(b,source.models[id].Front.animations.Skill-.1);
    assert.equal(normalHits,0);assert.equal(u.skill.spTotal,0);assert.equal(u.skill.active,true);
    tick(b,1);assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);assert.ok(normalHits>0);
    assert.ok(e.hp<100000);
  }
});
test('Poncirus HP talent waits30 seconds; S2 first ends and second remains with4-second DP ticks',()=>{
  const b=make([P],{[P]:{skillId:'skchr_buildr_2'}});let u=deploy(b,P);const hp=u.s.maxHp,atk=u.s.atk;
  tick(b,29.9);near(u.s.maxHp,hp);tick(b,.15);near(u.s.maxHp,hp*1.15);
  cast(b,u);near(b.dp,12);near(u.s.atk,atk*1.35);tick(b,15.1);assert.equal(u.skill.active,false);near(u.s.atk,atk);
  cast(b,u);near(b.dp,24);assert.equal(u.skill.kind,'toggle');tick(b,20);near(b.dp,29);assert.equal(u.skill.active,true);
  b.retreatOperator(P);tick(b,80);u=deploy(b,P);near(u.s.maxHp,hp);cast(b,u);assert.equal(u.skill.kind,'duration');
});
test('Reed S2 preserves the physical hit, adds independent Arts, doubles own kill DP and returns original deployment cost',()=>{
  const b=make([R],{[R]:{skillId:'skchr_sddrag_2'}}),u=deploy(b,R),e=enemy(b);
  near(u.s.res,u.base.res+20);cast(b,u);e.base.res=50;e.markDirty();
  b.forceAttack(u,[e]);tick(b,1);
  near(100000-e.hp,u.s.atk*(1+.35*.5));
  b.kill(e,u);near(b.dp,2);tick(b,30);assert.equal(u.profile.dpOnKill,1);
  const cost=u.base.cost;b.retreatOperator(R);near(b.dp,2+cost);
});
