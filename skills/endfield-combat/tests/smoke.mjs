import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'endfield-skill-'));
try{
 const op={id:'fixture',name:'合成干员',element:'物理',skills:{skill:{type:'skill',typeLabel:'战技',level:1,cost:100,timing:{estimatedExclusiveSeconds:1}},heavy:{type:'heavy',typeLabel:'重击',level:1,spRecovery:20,timing:{estimatedExclusiveSeconds:1}},ultimate:{type:'ultimate',cost:100}}};
 const input={dataVersion:'fixture',members:[{operator:op}],axis:{phases:[{id:'one',name:'第一轮'}],steps:[{id:'s',phaseId:'one',operatorId:'fixture',skillKey:'skill'},{id:'h',phaseId:'one',operatorId:'fixture',skillKey:'heavy'}],calculation:{panels:{fixture:{attack:100,critRate:0}},defense:0,repeats:3}}};
 const inputPath=path.join(tmp,'input.json');fs.writeFileSync(inputPath,JSON.stringify(input));const script=fileURLToPath(new URL('../scripts/run-axis.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[script,inputPath],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const output=JSON.parse(run.stdout);
 assert.equal(output.certification,'unverified');assert.equal(output.status,'incomplete');assert.ok(output.issues.some(s=>s.includes('命中')||s.includes('倍率')));
 assert.ok(output.issues.some(s=>s.includes('不附游戏专属机制适配器')));
 const profile={automatic:true,levels:{1:{events:[{offsetSeconds:.5,scale:1,element:'Physical'}]}}};
 const full={...input,damageProfilesPath:'complete-profiles.json',axis:{phases:[{id:'one',name:'完整合成循环'}],steps:[{id:'s',phaseId:'one',operatorId:'fixture',skillKey:'skill'},...Array.from({length:4},(_,i)=>({id:`h${i}`,phaseId:'one',operatorId:'fixture',skillKey:'heavy'}))],calculation:{panels:{fixture:{attack:100,critRate:0}},defense:0,repeats:3}}};
 fs.writeFileSync(path.join(tmp,'complete-profiles.json'),JSON.stringify({dataVersion:'fixture',profiles:{'fixture:skill':profile,'fixture:heavy':profile}}));
 fs.writeFileSync(inputPath,JSON.stringify(full));const computed=spawnSync(process.execPath,[script,inputPath],{encoding:'utf8'});assert.equal(computed.status,0,computed.stderr);
 const modeled=JSON.parse(computed.stdout);assert.equal(modeled.status,'modeled');assert.equal(modeled.modeledDirectDps,100);assert.equal(modeled.cycleSeconds,5);
 assert.equal(modeled.resourceFeasible,true);assert.equal(modeled.certification,'unverified','missing special-mechanism audit cannot become real-game proof');
 assert.equal(modeled.cycleLedger.length,3);assert.ok(modeled.eventLedger.length>modeled.actionLedger.length);
 const mismatch={...input,damageProfilesPath:'profiles.json'};fs.writeFileSync(path.join(tmp,'profiles.json'),JSON.stringify({dataVersion:'wrong',profiles:{}}));fs.writeFileSync(inputPath,JSON.stringify(mismatch));
 const rejected=spawnSync(process.execPath,[script,inputPath],{encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/版本不匹配/);
 console.log('portable skill: standalone execution, unknown mechanism disclosure and version rejection OK');
}finally{if(!path.resolve(tmp).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('temporary cleanup escaped temp directory');fs.rmSync(tmp,{recursive:true,force:true});}
