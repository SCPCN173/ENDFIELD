(function(global){
  'use strict';
  let pack=null;const cache=new Map(),clone=value=>JSON.parse(JSON.stringify(value));
  const ATTRS=[39,40,41,42];
  const ELEMENTS={50:'Physical',51:'Fire',52:'Pulse',53:'Cryst',54:'Natural'};
  const SKILLS={17:'heavy',28:'ultimate',32:'skill',33:'combo'};
  function configure(value,expectedVersion){pack=null;cache.clear();if(value?.schemaVersion!==1||value.dataVersion!==expectedVersion)throw new Error('自动数值包与游戏数据版本不一致');pack=clone(value);}
  function canResolve(member){return !!pack?.operators?.[member.operator.id];}
  function formula(base,mods){const v=type=>mods.filter(m=>m.modifierType===type).reduce((s,m)=>s+m.value,0);let value=(base+v(5))*(1+v(6));value=(value+v(7))*(1+v(8));value=(value+v(0))*(1+v(1));return (value+v(3))*(1+v(4));}
  function resolve(member){
    if(!canResolve(member))return {ready:false,missing:['自动数值数据尚未加载'],gaps:[]};
    const g=member.growth||{},oid=member.operator.id,wid=member.weaponId||member.weapon?.id||null;
    const equipmentIds=member.equipmentIds||member.equipment?.map(e=>e?.id)||[null,null,null,null];
    const signature=JSON.stringify([oid,wid,g,equipmentIds]);if(cache.has(signature))return clone(cache.get(signature));
    const source=pack.operators[oid],promotion=g.promotion??4,level=g.level??90;
    const records=(source.levels[String(level)]||[]).filter(row=>row.promotion<=promotion).sort((a,b)=>b.promotion-a.promotion);
    const missing=[],gaps=[],receipts=[],mods=[],skillPatches=[];
    if(!records.length)return {ready:false,missing:[`${member.operator.name}没有对应等级和突破的基础数据`],gaps:[]};
    const base=records[0].attributes;
    const add=(modifier,label)=>{if(!Number.isFinite(modifier.value)||![0,1,3,4,5,6,7,8].includes(modifier.modifierType)){gaps.push(`${label}存在未解析数值或属性修正类型`);return;}mods.push({...modifier,source:label});receipts.push({source:label,...modifier});};
    const effect=(item,label)=>{
      if(!item?.raw){gaps.push(`${label}来源缺失`);return;}
      for(const row of item.raw.dataList||[]){
        if(row.activeCondition?.length){gaps.push(`${label}含条件效果，待战斗适配`);continue;}
        if(row.modifyType===4){const m=row.attrModifier;add({...m,value:m.attrValue},label);}
        else if(row.modifyType===3&&row.skillBbModifier?.bbKey){const p=row.skillBbModifier;if([1,2,3].includes(p.modifyType))skillPatches.push({skillId:p.skillId,key:p.bbKey,operation:p.modifyType,value:p.floatValue,source:label});else gaps.push(`${label}的技能数值修正未适配`);}
        else gaps.push(`${label}含动态或尚未适配的效果`);
      }
    };
    const nodes=source.attributeNodes.filter(node=>node.promotion<=promotion);
    const trustNodes=g.trustNodes??((g.trust??100)===100?nodes.length:g.trust===0?0:null);
    if(trustNodes===null)missing.push('请在养成界面选择已解锁的能力强化节点');
    for(const node of nodes.slice(0,trustNodes??0))for(const m of node.modifiers)add({...m,value:m.attrValue},'能力强化');
    if(g.talentsUnlocked!==false){
      const selected=new Map();for(const item of source.talents)if(item.promotion<=promotion&&(!selected.has(item.index)||selected.get(item.index).level<item.level))selected.set(item.index,item);
      for(const item of selected.values())effect(item,`天赋 ${item.id}`);
    }
    for(const item of source.potential)if(item.level<=(g.potential??0))effect(item,`潜能 ${item.level}`);
    let weaponAttack=0;const weapon=wid?pack.weapons[wid]:null,traitLevels=[];
    if(wid&&!weapon)missing.push('所选武器缺少自动数值数据');
    if(weapon){
      const wl=g.weaponLevel??90;weaponAttack=weapon.baseAttack[String(wl)];if(!Number.isFinite(weaponAttack)){missing.push('武器缺少对应等级基础攻击');weaponAttack=0;}
      const stage=weapon.breakthroughs.filter(row=>row.breakthroughLv<=wl).sort((a,b)=>b.breakthroughLv-a.breakthroughLv)[0];
      const extra=weapon.potentials.find(row=>row.talentLv===(g.weaponPotential??0));
      weapon.traits.forEach((trait,index)=>{
        const bound=stage?.skillLevelBounds[index],bonus=extra?.skillLevelExtraBounds[index];
        const requested=(g.matrix?.mode==='none'?bound?.lowerBound:bound?.upperBound)+(bonus?.upperBound||0);
        const max=Math.max(0,...Object.keys(trait.levels).map(Number));
        const tl=Math.min(max,requested),value=trait.levels[String(tl)];traitLevels.push({id:trait.id,level:tl});
        if(!value){missing.push(`武器词条 ${trait.id}缺少等级数据`);return;}
        for(const modifier of value.modifiers)add(modifier,`武器 ${trait.id} Lv.${tl}`);
        gaps.push(...value.gaps.map(gap=>`武器 ${trait.id}：${gap}`));
      });
    }
    const suitCount={};
    equipmentIds.forEach((id,index)=>{
      if(!id)return;const item=pack.equipment[id];if(!item){missing.push('装备数值数据缺失');return;}
      if(item.suitId)suitCount[item.suitId]=(suitCount[item.suitId]||0)+1;
      const refinement=g.equipmentRefinement?.[index]??3;
      for(const attribute of [item.baseAttribute,...item.attributes].filter(Boolean)){
        const value=refinement>0&&attribute.enhancedAttrValues?.[refinement-1]!==undefined?attribute.enhancedAttrValues[refinement-1]:attribute.attrValue;
        const composite=attribute.attrType===0?attribute.packAttrType:null;
        add({attrType:attribute.attrType,modifierType:attribute.modifierType,modifyAttributeType:composite==='Main'?1:composite==='Sub'?2:0,
          ...(composite&&!['Main','Sub'].includes(composite)?{composite}:{}),value},`${item.name} · 精锻${refinement}`);
      }
    });
    for(const [sid,count]of Object.entries(suitCount))for(const effect of pack.suits[sid]||[])if(count>=effect.count){for(const modifier of effect.modifiers)add(modifier,`套装 ${sid}`);gaps.push(...effect.gaps.map(gap=>`套装 ${sid}：${gap}`));}
    const forAttribute=id=>mods.filter(m=>!m.composite&&(m.modifyAttributeType===1?id===source.mainAttrType:m.modifyAttributeType===2?id===source.subAttrType:m.modifyAttributeType===3?ATTRS.includes(id):m.attrType===id));
    const attributes=Object.fromEntries(ATTRS.map(id=>[id,formula(base[String(id)]||0,forAttribute(id))]));
    const rawAttack=formula((base['2']||0)+weaponAttack,forAttribute(2));
    const attributeMultiplier=1+Math.floor(attributes[source.mainAttrType])*pack.constants.mainAttackRate+Math.floor(attributes[source.subAttrType])*pack.constants.subAttackRate;
    const elements=Object.fromEntries(Object.entries(ELEMENTS).map(([id,element])=>[element,formula(0,forAttribute(Number(id)))*100]));
    const skills=Object.fromEntries(Object.entries(SKILLS).map(([id,key])=>[key,formula(0,forAttribute(Number(id)))*100]));
    const spell=mods.filter(m=>m.composite==='SpellDamageIncrease'||m.composite==='CrystAndPulseDamageIncrease'||m.composite==='FireAndNaturalDamageIncrease');
    for(const m of spell)for(const element of m.composite==='CrystAndPulseDamageIncrease'?['Cryst','Pulse']:m.composite==='FireAndNaturalDamageIncrease'?['Fire','Natural']:['Fire','Cryst','Pulse','Natural'])elements[element]+=m.value*100;
    for(const m of mods.filter(m=>m.composite==='AllSkillDamageIncrease'))for(const key of ['skill','combo','ultimate'])skills[key]+=m.value*100;
    const output={ready:!missing.length,missing,gaps:[...new Set(gaps)],attack:rawAttack*attributeMultiplier,
      critRate:formula(base['9']??0.05,forAttribute(9))*100,critDamage:formula(base['10']??pack.constants.baseCriticalDamage,forAttribute(10))*100,
      damageBonus:0,elementBonuses:elements,skillBonuses:skills,energyEfficiency:formula(base['44']??1,forAttribute(44))*100,
      attributes,weaponAttack,operatorAttack:base['2'],attackBeforeAttributes:rawAttack,attributeMultiplier,traitLevels,skillPatches,receipts,
      dataVersion:pack.dataVersion,numericVersion:pack.numericVersion};
    cache.set(signature,output);return clone(output);
  }
  function hitScale(member,hit){let value=hit.scale;for(const patch of resolve(member).skillPatches||[])if(patch.skillId===hit.sourceSkillId&&patch.key===hit.blackboardKey)value=patch.operation===1?value+patch.value:patch.operation===2?value*patch.value:patch.value;return value;}
  global.AutoStats={configure,resolve,canResolve,hitScale,get pack(){return pack;},VERSION:'0.1.0'};
})(typeof window!=='undefined'?window:self);
