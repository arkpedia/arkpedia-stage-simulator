// SPDX-License-Identifier: GPL-3.0-or-later
// Named interaction state: INVINCIBLE plus ability-trigger hold, not SILENCED.
const owned=new WeakSet();
export function attachSnakeInteractionWait(b,e,{onRemove}={}){
 const life=e.deploySeq;
 const buff=b.addBuff(e,{key:'enemy_musnake_during_click',source:e,persist:true,flags:{invulnerable:true},
  data:{snakeInteractionLife:life},onRemove});
 if(buff)owned.add(buff);return buff;
}
export function snakeInteractionWaiting(e){
 return e.buffs.some(buff=>owned.has(buff)&&buff.source===e&&buff.data?.snakeInteractionLife===e.deploySeq);
}
