// SPDX-License-Identifier: GPL-3.0-or-later
import {createHash} from 'node:crypto';
import {CN_NATIVE_PIN} from './cn-native-source.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const FIREWALL_ENVIRONMENT_BUNDLE=Object.freeze({path:'battle/prefabs/[uc]envsystems.ab',bytes:168719,
 md5:'6e5b86ee21792929fa22dff115ca0009',sha256:'42d2b4ed4b533fa4f001107f476c4cc6a10ff8d8e7c04448b9886a8052058e3f',
 manifestSha256:CN_NATIVE_PIN.manifestSha256});
export function verifiedFirewallEnvironmentSource(raw,inventoryRaw){
 const g=JSON.parse(raw),inventory=JSON.parse(inventoryRaw),pin=FIREWALL_ENVIRONMENT_BUNDLE;
 if(g.schemaVersion!==1||g.source?.inventory?.path!=='data/arkpedia-cn-native-source.json'||g.source.inventory.sha256!==sha(inventoryRaw)
  ||inventory.source.manifestSha256!==CN_NATIVE_PIN.manifestSha256||Object.entries(pin).some(([k,v])=>g.source.bundle?.[k]!==v))
  throw Error('Firewall environment publisher/inventory pins disagree');
 // This digest pins the complete local graph representation, independently of
 // its editable per-component hashes. The Python check reproduces the original.
 if(sha(JSON.stringify(g.prefabs))!=='b2c4dafa08bed7d985b68224cfb0ca2be0df716dce2cf3cee0037d5d67cec67a')
  throw Error('Firewall environment closure differs from retained original');
 for(const rows of Object.values(g.prefabs))for(const row of rows){
  if(!/^-?\d+$/.test(row.pathId)||!['GameObject','Transform','MonoBehaviour'].includes(row.componentType)||sha(row.originalJson)!==row.sha256)
   throw Error('Invalid firewall environment component');
 }
 return g;
}
