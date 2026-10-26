// SPDX-License-Identifier: GPL-3.0-or-later
// Only source-installed roles can expose a predefined field control. A map
// entry or matching character ID alone cannot acquire another deployment.
import{currentViyPredefined,VIY_PREDEFINED_KEY}from'./arkpedia-viy-predefined.js';
import{currentClosurPredefined,CLOSUR_PREDEFINED_KEY}from'./arkpedia-closur-predefined.js';
export function currentPredefinedControl(b,key){
 if(key===VIY_PREDEFINED_KEY)return currentViyPredefined(b);
 if(key===CLOSUR_PREDEFINED_KEY)return currentClosurPredefined(b);
 return null;
}
