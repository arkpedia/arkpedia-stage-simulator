// SPDX-License-Identifier: GPL-3.0-or-later
import {make as owner} from './mcnist-s3-owner-fixture.js';
import {prepareMcGrafS3Lifecycle,MCGRAF_S3_LIFECYCLE_CONTRACT} from '../../server/sim/content/arkpedia-mcgraf-s3-lifecycle.js';
export {enemy,advance,near,until} from './mcnist-s3-owner-fixture.js';
export function make({defer=false,contract=MCGRAF_S3_LIFECYCLE_CONTRACT,...opts}={}){
 const f=owner({...opts,defer:true});f.deck=prepareMcGrafS3Lifecycle(f.b,f.u,{contract,owner:f.controller});f.deck.install();if(!defer)f.deploy();return f;
}
