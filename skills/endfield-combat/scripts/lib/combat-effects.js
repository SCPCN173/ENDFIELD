(function(global){
  'use strict';
  const kinds=['damageBonus','amplification','vulnerability','damageTaken','attackFlat','critRate','critDamage'];
  const elements=['Physical','Fire','Cryst','Pulse','Natural'];
  function compile(profile,version){
    const pack=profile?.timelineEffects;
    if(!pack)return {hits:[],buffs:[]};
    if(pack.dataVersion!==version||pack.reviewed!==true||!pack.source||!pack.sha256||!Array.isArray(pack.effects))
      throw new Error('持续效果规则缺少匹配版本或来源审核');
    const hits=[],buffs=[];
    for(const effect of pack.effects){
      const allowed=effect.kind==='buff'?['kind','offsetSeconds','duration','buffKind','value','target','element','group']:['kind','offsetSeconds','duration','interval','firstTick','scale','element','sourceSkillId','blackboardKey'];
      if(Object.keys(effect).some(key=>!allowed.includes(key)))throw new Error('持续效果包含尚未解释的字段');
      if(!Number.isFinite(effect.offsetSeconds)||effect.offsetSeconds<0||!Number.isFinite(effect.duration)||effect.duration<=0)
        throw new Error('持续效果时刻或时长无效');
      if(effect.kind==='buff'){
        if(!kinds.includes(effect.buffKind)||!Number.isFinite(effect.value)||!['self','team'].includes(effect.target)||!['all',...elements].includes(effect.element))
          throw new Error('持续增益包含未支持的乘区、目标或属性');
        if(typeof effect.group!=='string'||!effect.group)throw new Error('持续增益缺少刷新分组');
        buffs.push({offsetSeconds:effect.offsetSeconds,buff:{kind:effect.buffKind,value:effect.value,duration:effect.duration,target:effect.target,element:effect.element,group:effect.group}});
      }else if(effect.kind==='periodicDamage'){
        if(!Number.isFinite(effect.interval)||effect.interval<=0||!Number.isFinite(effect.firstTick)||effect.firstTick<0||!Number.isFinite(effect.scale)||effect.scale<0||!elements.includes(effect.element))
          throw new Error('周期伤害参数无效');
        const count=Math.max(0,Math.ceil((effect.duration-effect.firstTick)/effect.interval-1e-9));
        if(count>10000)throw new Error('周期命中事件数量超限');
        for(let index=0;index<count;index++)hits.push({offsetSeconds:effect.offsetSeconds+effect.firstTick+index*effect.interval,scale:effect.scale,element:effect.element,periodic:true,
          ...(effect.sourceSkillId?{sourceSkillId:effect.sourceSkillId}:{}),...(effect.blackboardKey?{blackboardKey:effect.blackboardKey}:{})});
      }else throw new Error(`持续效果类型尚未支持：${effect.kind}`);
    }
    return {hits,buffs};
  }
  global.CombatEffects={compile,VERSION:'0.1.0'};
})(typeof window!=='undefined'?window:self);
