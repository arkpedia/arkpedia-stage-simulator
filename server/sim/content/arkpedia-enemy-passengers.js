// SPDX-License-Identifier: GPL-3.0-or-later
/** A carrier owns existing enemy identities, never replacement spawns. Hidden
 * passengers retain HP/buffs/counts; their attack and route clocks are suspended. */
export class EnemyPassengerContainer {
  constructor(b,host,{capacity,radius,offset,eligible}) {
    this.b=b;this.host=host;this.capacity=capacity;this.radius=radius;this.offset=offset;
    this.eligible=eligible;this.records=new Map();
  }
  capture(u) {
    const b=this.b,h=this.host;
    if(this.records.size>=this.capacity||!h.alive||h.hidden||u===h||!u.alive||!u.deployed||u.hidden
      ||u.mem.enemyPassengerOf||!this.eligible(u)||Math.hypot(u.x-h.x,u.y-h.y)>this.radius+1e-9)return false;
    this.records.set(u.id,{unit:u,pauseUntil:u.pauseUntil});u.mem.enemyPassengerOf=h;
    u.pauseUntil=Infinity;u.moving=false;u.atkStandUntil=-Infinity;b._setHidden(u,true);
    u.x=h.x;u.y=h.y;u.tileR=Math.round(u.y);u.tileC=Math.round(u.x);
    return true;
  }
  tick() {
    const h=this.host;
    for(const[id,r]of this.records){
      if(!r.unit.alive){delete r.unit.mem.enemyPassengerOf;this.records.delete(id);continue;}
      r.unit.x=h.x;r.unit.y=h.y;r.unit.tileR=Math.round(h.y);r.unit.tileC=Math.round(h.x);
    }
    if(h.alive&&h.deployed&&!h.hidden)for(const u of this.b.enemies.slice())this.capture(u);
  }
  release(reason='killed') {
    const b=this.b,h=this.host,records=[...this.records.values()];this.records.clear();
    for(const r of records){
      const u=r.unit;delete u.mem.enemyPassengerOf;if(!u.alive||!u.deployed)continue;
      u.pauseUntil=r.pauseUntil;u.x=h.x;u.y=h.y;
      if(reason==='leak'){b.leak(u);continue;}
      const route=h.route;
      if(route)u.route={legs:route.legs.map(leg=>({...leg})),legIdx:route.legIdx,waitLeft:route.waitLeft,
        pts:null,ptIdx:0,suffix:null,version:-1};
      // Native square scatter is bounded by the board and passable ground.
      const x=u.x+b.rng.range(-this.offset,this.offset),y=u.y+b.rng.range(-this.offset,this.offset);
      const tile=b.grid.tile(Math.round(y),Math.round(x));
      if(x>=b.rect.c0&&x<=b.rect.c1&&y>=b.rect.r0&&y<=b.rect.r1&&tile?.pass==='ALL'){u.x=x;u.y=y;}
      u.tileR=Math.round(u.y);u.tileC=Math.round(u.x);u.atkStandUntil=-Infinity;b._setHidden(u,false);
    }
  }
}
export function beachBus(p){
  const eligible=u=>u.side==='enemy'&&!u.isBoss&&u.def.rank!=='BOSS'&&!u.tags.has('machine')&&!u.findBuff('enemy_durbus_t[mark]')
    &&!u.isFlying&&!u.s.flags.liftoff&&!u.s.flags.untargetable&&!u.s.flags.isolated&&!u.s.flags.sleep
    &&u.kind==='enemy';
  return {
    spawn(b,e,a){b.addBuff(e,{key:'enemy_durbus_t[mark]',persist:true});
      a.passengers=new EnemyPassengerContainer(b,e,{...p,eligible});},
    tick(_b,_e,a){a.passengers.tick();},
    death(c,_b,_e,a){a.passengers.release(c.reason);},
  };
}
