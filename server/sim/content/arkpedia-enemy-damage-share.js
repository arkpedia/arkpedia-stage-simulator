// SPDX-License-Identifier: GPL-3.0-or-later
/** Transfer a fraction of mitigated damage as equal HP losses to a selected
 * friendly group. The HP-loss path preserves attribution without mitigation
 * twice, damage-hook recursion, or an invented damage cap on a dying member. */
export function markedEnemyDamageShare({ratio,mark}) {
  const eligible=(e,u)=>u!==e&&u.side===e.side&&u.kind==='enemy'&&u.alive&&u.deployed&&!u.hidden&&!u.isFlying
    &&!u.s.flags.untargetable&&!u.s.flags.invulnerable&&!u.s.flags.sleep&&!!u.findBuff(mark);
  return {
    spawn(b,e,a){
      a.off=b.on('damageFinal',c=>{
        if(c.target!==e||!e.alive||!e.deployed||c.dmg.instantKillLike||c.cancel||!(c.amount>0))return;
        const targets=b.enemies.filter(u=>eligible(e,u));
        if(!targets.length)return;
        const transfer=c.amount*ratio,part=transfer/targets.length;c.amount-=transfer;
        for(const target of targets)b.loseHp(target,part,{source:c.credit,from:c.dmg,tags:['enemyDamageShare']});
      },{priority:-2000});
    },
    death(_c,b,_e,a){b.off(a.off);},
  };
}
