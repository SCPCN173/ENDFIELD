(function(global){
  'use strict';
  // Only developer-audited, version-bound profiles can enable overlap.
  function rule(profile,dataVersion){
    const value=profile?.scheduling;
    if(!value)return null;
    if(value.dataVersion!==dataVersion||value.reviewed!==true||!value.source||!value.sha256||
       !['actorSeconds','globalSeconds'].every(k=>Number.isFinite(value[k])&&value[k]>=0)||value.actorSeconds<=0)
      throw new Error('并行占用规则缺少版本、审核来源或有效时长');
    if(value.resourceLocks!==undefined&&(!Array.isArray(value.resourceLocks)||value.resourceLocks.some(lock=>
      typeof lock.name!=='string'||!lock.name||!Number.isFinite(lock.seconds)||lock.seconds<0)))
      throw new Error('共享操作资源占用规则无效');
    return value;
  }
  function create(){
    const busy=new Map(),resources=new Map();let cursor=0,finish=0;
    return {
      place(actor,duration,wait,hits,profile,dataVersion,effectStarts=[]){
        const policy=rule(profile,dataVersion);
        const locks=policy?.resourceLocks||[];
        const start=Math.max(cursor+(wait||0),busy.get(actor)||0,...locks.map(lock=>resources.get(lock.name)||0));
        const end=start+(policy?policy.actorSeconds:duration);
        const release=start+(policy?policy.globalSeconds:duration);
        const effectEnd=Math.max(end,...hits.map(hit=>start+hit.offsetSeconds),...effectStarts.map(offset=>start+offset));
        busy.set(actor,end);cursor=release;finish=Math.max(finish,effectEnd,release);
        for(const lock of locks){resources.set(lock.name,start+lock.seconds);finish=Math.max(finish,start+lock.seconds);}
        return {start,end,effectEnd,release,parallelReviewed:!!policy};
      },
      barrier(wait=0){cursor=Math.max(cursor,finish)+wait;finish=cursor;return cursor;},
      checkpoint(wait=0){cursor+=wait;finish=Math.max(finish,cursor);return cursor;},
      complete(){cursor=Math.max(cursor,finish);return cursor;},
      get cursor(){return cursor;},get finish(){return finish;}
    };
  }
  global.RotationScheduling={rule,create};
})(typeof window!=='undefined'?window:self);
