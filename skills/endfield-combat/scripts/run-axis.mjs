import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const inputPath=process.argv[2];if(!inputPath){process.stderr.write('用法: node run-axis.mjs <输入JSON> [输出JSON]\n');process.exit(2);}
const readJson=p=>{const bytes=fs.readFileSync(p);if(bytes.length>20_000_000)throw Error(`输入文件过大: ${p}`);return{value:JSON.parse(bytes.toString('utf8')),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};};
try{
 const input=readJson(inputPath).value;
 if(typeof input.dataVersion!=='string'||!input.dataVersion||!Array.isArray(input.members)||!input.members.length||!input.axis)throw Error('缺少dataVersion、members或axis');
 const sources={};for(const [key,field]of [['numeric','numericDataPath'],['profiles','damageProfilesPath'],['mechanics','mechanicRegistryPath']]){
  if(input[field]){const source=path.resolve(path.dirname(inputPath),input[field]);sources[key]={path:source,...readJson(source)};}
 }
 for(const [key,source]of Object.entries(sources))if(source.value?.dataVersion!==input.dataVersion)throw Error(`${key}数据包版本不匹配`);
 const window={};const sandbox=vm.createContext({window,self:window,console,setTimeout});
 const load=name=>vm.runInContext(fs.readFileSync(path.join(dir,'lib',name+'.js'),'utf8'),sandbox,{filename:name+'.js'});
 load('rotation-scheduling');load('combat-effects');
 if(sources.numeric){load('auto-stats');window.AutoStats.configure(sources.numeric.value,input.dataVersion);}
 load('rotation-model');
 const result=window.RotationModel.evaluate(input.axis,input.members,sources.profiles?.value||null,{captureEvents:true});
 const issues=[...(result.missing||[]).map(x=>x.text),...(result.errors||[]).map(x=>x.text),...(result.deficits||[])];
 if(!sources.numeric)issues.push('自动数值包未提供；不能以猜测面板认证伤害');
 if(!sources.profiles)issues.push('直接命中事件包未提供；不能认证DPS');
 issues.push('公开版不附游戏专属机制适配器；专属资源、连携条件与循环状态不能完整认证');
 if(sources.mechanics)issues.push('提供的机制包只记录版本和哈希；公开版不会执行其中声明的专属适配器');
 const output={skill:'endfield-combat',dataVersion:input.dataVersion,sourcePackages:Object.fromEntries(Object.entries(sources).map(([key,v])=>[key,{path:v.path,sha256:v.sha256}])),
  status:result.status,certification:'unverified',scope:'版本化来源的声明模型；非实战总DPS或全局最优',
  modeledDirectDps:result.status==='modeled'?result.modeledDps:null,cycleSeconds:result.cycleSeconds,resourceFeasible:result.feasible===true,
  issues:[...new Set(issues)],warnings:result.warnings||[],eventLedger:result.eventLedger||[],actionLedger:result.actions||[],cycleLedger:result.periods||[]};
 const rendered=JSON.stringify(output,null,2)+'\n';if(process.argv[3])fs.writeFileSync(process.argv[3],rendered);else process.stdout.write(rendered);
}catch(error){process.stderr.write(`重放未完成: ${error.message}\n`);process.exitCode=1;}
