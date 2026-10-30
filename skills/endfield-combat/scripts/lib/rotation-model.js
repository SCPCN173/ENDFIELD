(function (global) {
  "use strict";
  const EPS = 1e-7;
  const TYPES = ["heavy", "skill", "combo", "ultimate"];
  const ELEMENTS = ["Physical", "Fire", "Cryst", "Pulse", "Natural"];
  const ELEMENT_NAMES = { 物理: "Physical", 灼热: "Fire", 寒冷: "Cryst", 电磁: "Pulse", 自然: "Natural" };
  const finite = (n) => typeof n === "number" && Number.isFinite(n);
  const number = (value, fallback = null) => value == null || value === "" || !Number.isFinite(Number(value)) ? fallback : Number(value);
  const declared = (source, key, fallback) => Object.prototype.hasOwnProperty.call(source || {}, key) ? number(source[key]) : fallback;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const id = () => `axis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  function settings(members, input) {
    const source = input || {};
    const panels = {};
    for (const member of members || []) {
      const op = member.operator;
      const saved = source.panels?.[op.id] || {};
      panels[op.id] = { attack: number(saved.attack), critRate: declared(saved, "critRate", 5), critDamage: declared(saved, "critDamage", 50),
        damageBonus: declared(saved, "damageBonus", 0), energyEfficiency: declared(saved, "energyEfficiency", 100), initialEnergy: declared(saved, "initialEnergy", 0) };
      if (global.AutoStats && source.panelMode !== "manual") {
        const automatic = global.AutoStats.resolve(member);
        panels[op.id] = { ...automatic, initialEnergy: declared(saved, "initialEnergy", 0) };
      }
    }
    const repeats = declared(source, "repeats", 3);
    return { panels, panelMode: source.panelMode === "manual" ? "manual" : "auto", initialSp: declared(source, "initialSp", 200), spCap: declared(source, "spCap", 300),
      spRegen: declared(source, "spRegen", 8), skillEnergyRate: declared(source, "skillEnergyRate", 0.065),
      skillRegenPause: declared(source, "skillRegenPause", 0.5), defense: declared(source, "defense", 100),
      resistances: Object.fromEntries(ELEMENTS.map((element) => [element, declared(source.resistances, element, 0)])),
      repeats: finite(repeats) ? Math.max(2, Math.min(10, Math.round(repeats))) : null,
      rulesSource: "research-baseline-editable", ...("tailWait" in source ? { tailWait: number(source.tailWait, 0) } : {}) };
  }
  function normalize(axis, members, profiles) {
    const source = axis || {};
    const phases = (source.phases?.length ? source.phases : [{ id: id(), name: "第 1 轮" }]).map((row, i) => ({
      id: String(row.id || id()), name: String(row.name || `第 ${i + 1} 轮`).slice(0, 40), waitAfter: Math.max(0, number(row.waitAfter, 0)),
    }));
    const memberMap = new Map((members || []).map((member) => [member.operator.id, member]));
    const steps = [];
    for (const step of source.steps || []) {
      const member = memberMap.get(step.operatorId);
      const key = step.skillKey === "attack" ? "heavy" : step.skillKey;
      const skill = member?.operator.skills?.[key];
      if (!skill || !TYPES.includes(skill.type)) continue;
      const profile = profiles?.profiles?.[`${step.operatorId}:${key}`];
      const saved = step.calculation || {};
      const duration = Object.prototype.hasOwnProperty.call(saved, "duration") ? number(saved.duration) : number(skill.timing?.estimatedExclusiveSeconds);
      const events = profile?.levels?.[String(skill.level || 1)]?.events || [];
      const lastHit = events.reduce((max, event) => Math.max(max, event.offsetSeconds), 0);
      const automatic = profile?.automatic && events.length;
      steps.push({ ...step, id: String(step.id || id()), skillKey: key,
        phaseId: phases.some((row) => row.id === step.phaseId) ? step.phaseId : phases[0].id,
          calculation: { duration: finite(duration) && duration > 0 ? Math.max(duration, saved.manualTiming || profile?.scheduling ? duration : lastHit) : null,
          manualTiming: saved.manualTiming === true, waitBefore: Math.max(0, number(saved.waitBefore, 0)),
          damageMode: saved.damageMode === "manual" && number(saved.scalePercent) !== null ? "manual" : "auto",
          scalePercent: number(saved.scalePercent), hits: Math.max(1, Math.min(100, Math.round(number(saved.hits, 1)))),
          element: ELEMENTS.includes(saved.element) ? saved.element : ELEMENT_NAMES[member.operator.element] || "Physical",
          triggerConfirmed: skill.type !== "combo" || saved.triggerConfirmed === true,
          comboEnergy: number(saved.comboEnergy, skill.comboEnergyGain), restoreSp: Math.max(0, number(saved.restoreSp, 0)),
          refundSp: Math.max(0, number(saved.refundSp, 0)), selfEnergy: Math.max(0, number(saved.selfEnergy, 0)),
          energyLock: Math.max(0, number(saved.energyLock, 0)), buff: saved.buff ? clone(saved.buff) : null,
          mechanics: { airChain: saved.mechanics?.airChain === true,
            adapterInputs: Object.prototype.hasOwnProperty.call(saved.mechanics||{},"adapterInputs") ? clone(saved.mechanics.adapterInputs) : {},
            naturalBursts: declared(saved.mechanics, "naturalBursts", 0),
            natureConsumed: declared(saved.mechanics, "natureConsumed", 0),
            arrowSpend: declared(saved.mechanics, "arrowSpend", 0) } },
      });
    }
    return { ...source, name: source.name || "队伍循环", phases, steps, calculation: settings(members, source.calculation) };
  }
  function ordered(axis) {
    return axis.phases.flatMap((row) => axis.steps.filter((step) => step.phaseId === row.id));
  }
  function move(axis, stepId, targetRow, beforeId) {
    if (!axis.phases.some((row) => row.id === targetRow)) return false;
    const step = axis.steps.find((entry) => entry.id === stepId);
    if (!step || beforeId === stepId) return false;
    axis.steps = axis.steps.filter((entry) => entry.id !== stepId);
    step.phaseId = targetRow;
    const before = axis.steps.findIndex((entry) => entry.id === beforeId && entry.phaseId === targetRow);
    if (before >= 0) axis.steps.splice(before, 0, step);
    else {
      const last = axis.steps.map((entry) => entry.phaseId).lastIndexOf(targetRow);
      if (last < 0) axis.steps.push(step); else axis.steps.splice(last + 1, 0, step);
    }
    return true;
  }
  function damage(attack, scale, panel, enemy, buffValues) {
    const buffs = buffValues || {};
    const rate = Math.max(0, Math.min(1, (panel.critRate + (buffs.critRate || 0)) / 100));
    const critical = 1 + rate * Math.max(0, (panel.critDamage + (buffs.critDamage || 0)) / 100);
    const bonus = Math.max(0, 1 + (panel.damageBonus + (buffs.damageBonus || 0)) / 100);
    const defense = 100 / (100 + enemy.defense);
    const resistance = 1 - enemy.resistance / 100;
    return Math.max(0, attack + (buffs.attackFlat || 0)) * scale * critical * bonus * defense * resistance *
      Math.max(0, 1 + (buffs.amplification || 0) / 100) * Math.max(0, 1 + (buffs.vulnerability || 0) / 100) * Math.max(0, 1 + (buffs.damageTaken || 0) / 100);
  }
  function evaluate(rawAxis, members, profiles, options = {}) {
    const resourcesOnly = options.resourcesOnly === true;
    const axis = normalize(rawAxis, members, profiles);
    const config = axis.calculation;
    const missing = [];
    const warnings = new Set(["计算范围：已配置的攻击力直伤与手动增益；未自动计入异常反应、召唤物、后台普攻、全部天赋和装备动态效果。",
      "资源规则采用研究基线；返还技力按优先支出的保守策略记账，特殊角色回能仍有待开发适配的缺口。"]);
    const memberMap = new Map(members.map((member, slot) => [member.operator.id, { ...member, slot }]));
    const timeline = [];
    const rowTimes = [];
    let time = 0;
    const scheduler=global.RotationScheduling?.create();
    let conditionsConfirmed = true;
    let resourcesComplete = true;
    const addMissing = (step, text) => missing.push({ stepId: step?.id || null, text });
    if (profiles?.dataVersion && global.CombatMechanics?.registry && profiles.dataVersion!==global.CombatMechanics.registry.dataVersion) addMissing(null,"伤害事件包与机制包版本不同，不能混用计算。");
    for(const issue of global.CombatMechanics?.reviewIssues(axis,members,profiles)||[])addMissing(null,issue);
    for (const key of ["initialSp", "spCap", "spRegen", "skillEnergyRate", "skillRegenPause", ...(resourcesOnly ? [] : ["defense"])]) {
      if (!finite(config[key]) || config[key] < 0) addMissing(null, `计算条件无效：${key}`);
    }
    if (config.spCap <= 0 || config.initialSp > config.spCap) addMissing(null, "初始技力必须在技力上限内。");
    if (!options.singlePass && (!Number.isInteger(config.repeats) || config.repeats < 2 || config.repeats > 10)) addMissing(null, "重复验证次数需为 2 至 10 的整数。");
    if (!resourcesOnly) for (const element of ELEMENTS) if (!finite(config.resistances[element]) || config.resistances[element] < -100 || config.resistances[element] > 90) addMissing(null, `${element} 抗性需在 -100 至 90 之间。`);
    for (const row of axis.phases) {
      const start = time;
      for (const step of axis.steps.filter((entry) => entry.phaseId === row.id)) {
        const member = memberMap.get(step.operatorId);
        const skill = member.operator.skills[step.skillKey];
        const input = step.calculation;
        const label = `${member.operator.name} · ${skill.typeLabel}`;
        const panel = config.panels[step.operatorId];
        if (!resourcesOnly && !(input.damageMode === "manual" && input.scalePercent === 0) && (!finite(panel.attack) || panel.attack <= 0)) addMissing(step, `${member.operator.name}：${config.panelMode === "auto" ? (panel.missing || ["自动属性数据缺失"]).join("；") : "高级校准攻击力无效"}。`);
        if (!resourcesOnly) for (const gap of panel.gaps || []) warnings.add(`${member.operator.name}：${gap}`);
        if (!resourcesOnly && (!finite(panel.critRate) || panel.critRate < 0 || panel.critRate > 100 || !finite(panel.critDamage) || panel.critDamage < 0 || !finite(panel.damageBonus) || panel.damageBonus < -100)) addMissing(step, `${member.operator.name}：暴击或增伤条件无效。`);
        if (!finite(input.duration) || input.duration <= 0) addMissing(step, `${label}：请填写实际动作耗时。`);
        if (!input.manualTiming) warnings.add("动作耗时采用原始独占帧的名义估算；可在动作详情中校准，重击须含前置普攻连段。");
        if (skill.type === "heavy" && member.slot !== 0) addMissing(step, `${label}：当前只支持第 1 位主控的重击周期。`);
        if (skill.type === "combo" && !input.triggerConfirmed && !global.CombatMechanics?.canValidateCombo(step.operatorId)) { conditionsConfirmed = false; warnings.add(`${label}的触发条件未人工确认。`); }
        for (const key of ["naturalBursts", "natureConsumed", "arrowSpend"]) if (!Number.isInteger(input.mechanics[key]) || input.mechanics[key] < 0 || input.mechanics[key] > (key === "arrowSpend" ? 4 : 5)) addMissing(step, `${label}的机制校准值 ${key} 无效。`);
        if (!input.mechanics.adapterInputs || typeof input.mechanics.adapterInputs!=="object" || Array.isArray(input.mechanics.adapterInputs)) addMissing(step,`${label}的扩展机制参数必须为对象。`);
        if (skill.type === "combo" && !finite(input.comboEnergy)) { resourcesComplete = false; warnings.add(`${label}缺少连携回能，无法验证完整资源循环。`); }
        if (["skill", "ultimate"].includes(skill.type) && (!finite(skill.cost) || skill.cost < 0)) { resourcesComplete = false; warnings.add(`${label}缺少资源消耗字段。`); }
        if (skill.type === "heavy" && (!finite(skill.spRecovery) || skill.spRecovery < 0)) { resourcesComplete = false; warnings.add(`${label}缺少重击技力恢复字段。`); }
        if (["combo", "ultimate"].includes(skill.type) && (!finite(skill.cooldown) || skill.cooldown < 0)) { resourcesComplete = false; warnings.add(`${label}缺少冷却字段。`); }
        const profile = profiles?.profiles?.[`${step.operatorId}:${step.skillKey}`];
        let effects={hits:[],buffs:[]};
        try{
          if(profile?.timelineEffects&&!global.CombatEffects)throw new Error('持续效果解释器未加载');
          if(profile?.timelineEffects&&!scheduler)throw new Error('持续效果调度器未加载');
          effects=global.CombatEffects?.compile(profile,profiles?.dataVersion)||effects;
        }catch(error){addMissing(step,`${label}：${error.message}`);}
        let hits = [];
        if (resourcesOnly) {
          // Preserve source-backed hit timing for resource/condition adapters without inventing damage values.
          if (profile?.automatic) hits = (profile.levels?.[String(skill.level || 1)]?.events || []).filter(event => !event.mainOnly || member.slot === 0);
        } else if (input.damageMode === "auto") {
          hits = (profile?.automatic ? profile.levels?.[String(skill.level || 1)]?.events || [] : []).filter((event) => !event.mainOnly || member.slot === 0);
          if (!hits.length) addMissing(step, `${label}的自动伤害事件待开发适配，无需填写研究参数。`);
          if (!profile?.scheduling && hits.some((hit) => hit.offsetSeconds > input.duration + EPS)) addMissing(step, `${label}的耗时早于最后命中；请校准耗时或改用手动命中。`);
        } else {
          if (!finite(input.scalePercent) || input.scalePercent < 0) addMissing(step, `${label}：自动伤害事件尚未适配，当前不能计入完整 DPS。`);
          hits = Array.from({ length: input.hits }, (_, i) => ({ offsetSeconds: (input.duration || 0) * (i + 1) / input.hits, scale: (input.scalePercent || 0) / 100, element: input.element }));
          warnings.add("手动倍率按所填命中数计算；多次命中均匀分布在动作时间内，实际帧序需继续校准。");
        }
        const buff = input.buff;
        if(resourcesOnly||input.damageMode==='auto')hits=[...hits,...effects.hits];
        if (buff && (!finite(number(buff.value)) || !finite(number(buff.duration)) || number(buff.duration) < 0 || !["damageBonus", "amplification", "vulnerability", "damageTaken", "attackFlat", "critRate", "critDamage"].includes(buff.kind))) addMissing(step, `${label}的增益设置无效。`);
        if(scheduler){
          try {
            const placement=scheduler.place(step.operatorId,input.duration||0,input.waitBefore,hits,profile,profiles?.dataVersion,effects.buffs.map(effect=>effect.offsetSeconds));
            timeline.push({step,member,skill,hits,effects,...placement,rowId:row.id});time=scheduler.cursor;
          } catch(error){addMissing(step,`${label}：${error.message}`);}
        } else {
          time += input.waitBefore;
          timeline.push({ step, member, skill, hits, effects, start: time, end: time + (input.duration || 0), rowId: row.id });
          time += input.duration || 0;
        }
      }
      time = scheduler ? scheduler.checkpoint(row.waitAfter) : time + row.waitAfter;
      rowTimes.push({ id: row.id, name: row.name, start, end: time });
    }
    if(scheduler){time=scheduler.complete();if(rowTimes.length)rowTimes[rowTimes.length-1].end=time;}
    if (!timeline.length || time <= 0) addMissing(null, "先在横轴中放入动作，并配置大于 0 的循环时长。");
    for (const member of members) {
      const panel = config.panels[member.operator.id];
      const cost = member.operator.skills?.ultimate?.cost;
      if (resourcesOnly && (!finite(cost) || cost < 0)) addMissing(null, `${member.operator.name}缺少终结技能量上限，暂不能核对续接回能。`);
      if (!finite(panel.energyEfficiency) || panel.energyEfficiency < 0 || !finite(panel.initialEnergy) || panel.initialEnergy < 0 || panel.initialEnergy > cost) addMissing(null, `${member.operator.name}的充能效率或初始能量无效。`);
    }
    if (resourcesOnly && !resourcesComplete) addMissing(null, "前置动作缺少消耗、回能或冷却数据，暂不能推算续接资源。");
    if (missing.length) return { status: "incomplete", scope: resourcesOnly ? "declared-resources" : "declared-direct-damage", missing,
      warnings: [...warnings], cycleSeconds: time, timeline, rowTimes, modeledDps: null, modeledDamage: null, feasible: false };

    const state = { time: 0, sp: config.initialSp, refundedSp: 0, energy: Object.fromEntries(members.map((m) => [m.operator.id, config.panels[m.operator.id].initialEnergy])),
      cooldowns: {}, locks: {}, regenPausedUntil: 0, buffs: [] };
    const snapshot = () => ({ time: state.time, sp: state.sp, refundedSp: state.refundedSp, energy: { ...state.energy },
      cooldowns: Object.fromEntries(Object.entries(state.cooldowns).map(([key, until]) => [key, Math.max(0, until - state.time)])),
      locks: Object.fromEntries(Object.entries(state.locks).map(([key, until]) => [key, Math.max(0, until - state.time)])),
      regenPause: Math.max(0, state.regenPausedUntil - state.time),
      buffs: state.buffs.filter((b) => b.until > state.time + EPS).map((b) => ({ group: b.group, target: b.target, kind: b.kind, value: b.value, element: b.element, remaining: b.until - state.time })),
      ...(mechanics ? { mechanics: mechanics.snapshot() } : {}) });
    const restoreSp = (gain, refunded = false) => { const amount = Math.max(0, Math.min(gain, config.spCap - state.sp)); state.sp += amount; if (refunded) state.refundedSp += amount; };
    const advanceBase = (until) => { restoreSp(Math.max(0, until - Math.max(state.time, state.regenPausedUntil)) * config.spRegen); state.time = until; state.buffs = state.buffs.filter((b) => b.until > until + EPS); };
    const advance = until => mechanics ? mechanics.advance(until, advanceBase) : advanceBase(until);
    const gainEnergy = (actorId, amount) => {
      if ((state.locks[actorId] || 0) > state.time + EPS) return;
      const cap = memberMap.get(actorId).operator.skills.ultimate.cost;
      state.energy[actorId] = Math.min(cap, state.energy[actorId] + amount * config.panels[actorId].energyEfficiency / 100);
    };
    const mechanics = global.CombatMechanics?.create(members, { state, gainEnergy });
    const events = [];
    const passes = options.singlePass ? 1 : config.repeats;
    const periods = Array.from({ length: passes }, (_, cycle) => ({ cycle, damage: 0, start: null, end: null, rows: rowTimes.map((row) => ({ ...row, damage: 0, startState: null, endState: null })) }));
    const actionEvents = [];
    for (let cycle = 0; cycle < passes; cycle += 1) {
      const origin = cycle * time;
      events.push({ time: origin, order: cycle * timeline.length * 1000 - 2, kind: "cycle-start", cycle });
      for (let rowIndex = 0; rowIndex < rowTimes.length; rowIndex += 1) {
        const row = rowTimes[rowIndex];
        const before = timeline.filter((entry) => entry.start < row.start - EPS).length;
        const after = timeline.filter((entry) => entry.start < row.end - EPS).length;
        events.push({ time: origin + row.start, order: (cycle * timeline.length + before) * 1000 - 1, kind: "row-start", cycle, rowIndex });
        events.push({ time: origin + row.end, order: (cycle * timeline.length + after) * 1000 - 3, kind: "row-end", cycle, rowIndex });
      }
      timeline.forEach((entry, index) => {
        const order = (cycle * timeline.length + index) * 1000;
        const common = { entry, cycle, actionKey: `${cycle}:${entry.step.id}` };
        events.push({ ...common, time: origin + entry.start, order, kind: "cast" });
        for(const [index,effect] of (entry.effects?.buffs||[]).entries())events.push({...common,time:origin+entry.start+effect.offsetSeconds,order:order+1+index,kind:'buff',buff:effect.buff});
        entry.hits.forEach((hit, i) => events.push({ ...common, time: origin + entry.start + hit.offsetSeconds, order: order + 100 + i, kind: "damage", hit }));
        events.push({ ...common, time: origin + entry.end, order: order + 900, kind: "recover" });
        events.push({ ...common, time: origin + entry.end, order: order + 990, kind: "action-end" });
        const buff = entry.step.calculation.buff;
        if (buff && number(buff.duration) > 0 && number(buff.value) !== 0) events.push({ ...common, time: origin + (buff.at === "start" ? entry.start : entry.end), order: order + (buff.at === "start" ? 1 : 950), kind: "buff", buff });
      });
      events.push({ time: origin + time, order: (cycle + 1) * timeline.length * 1000 - 2.5, kind: "cycle-end", cycle });
    }
    // Equivalent frame-derived boundaries can differ by floating point ulps.
    // Canonicalize time before sorting; never use a non-transitive epsilon comparator.
    for(const event of events)event.time=Math.round(event.time*1e9)/1e9;
    events.sort((a, b) => a.time - b.time || a.order - b.order);
    const errors = [];
    const eventLedger=[];
    const invalid = new Set();
    for (const event of events) {
      advance(event.time);
      const record=options.captureEvents?{time:state.time,kind:event.kind,cycle:event.cycle,stepId:event.entry?.step.id||null,rowId:event.entry?.rowId||rowTimes[event.rowIndex]?.id||null,hit:event.hit||null,before:snapshot()}:null;
      try {
      const period = periods[event.cycle];
      if (event.kind === "cycle-start") { period.start = snapshot(); continue; }
      if (event.kind === "cycle-end") { period.end = snapshot(); continue; }
      if (event.kind === "row-start") { period.rows[event.rowIndex].startState = snapshot(); continue; }
      if (event.kind === "row-end") { period.rows[event.rowIndex].endState = snapshot(); continue; }
      const { entry } = event;
      const { step, skill, member } = entry;
      const input = step.calculation;
      const actorId = member.operator.id;
      const key = `${actorId}:${step.skillKey}`;
      if (event.kind === "cast") {
        const before = snapshot();
        const reasons = [...(mechanics?.gate(entry) || [])];
        if ((state.cooldowns[key] || 0) > state.time + EPS) reasons.push("冷却未结束");
        if (skill.type === "skill" && state.sp + EPS < skill.cost) reasons.push("技力不足");
        if (skill.type === "ultimate" && state.energy[actorId] + EPS < skill.cost) reasons.push("终结技能量不足");
        if (reasons.length) {
          invalid.add(event.actionKey);
          errors.push({ cycle: event.cycle, stepId: step.id, time: state.time, text: `${member.operator.name} · ${skill.typeLabel}：${reasons.join("、")}` });
        } else {
          if (skill.type === "skill") {
            const refunded = Math.min(skill.cost, state.refundedSp);
            state.refundedSp -= refunded; state.sp -= skill.cost;
            for (const id of memberMap.keys()) gainEnergy(id, (skill.cost - refunded) * config.skillEnergyRate);
            state.regenPausedUntil = Math.max(state.regenPausedUntil, state.time + config.skillRegenPause);
          }
          if (skill.type === "combo" && finite(input.comboEnergy)) gainEnergy(actorId, input.comboEnergy);
          if (skill.type === "ultimate") {
            state.energy[actorId] = 0;
            state.locks[actorId] = state.time + input.energyLock;
            state.regenPausedUntil = Math.max(state.regenPausedUntil, state.time + input.duration);
          }
          if (["combo", "ultimate"].includes(skill.type)) state.cooldowns[key] = state.time + skill.cooldown;
          mechanics?.onEvent("action-start", { ...entry, cycle:event.cycle });
        }
        actionEvents.push({ cycle: event.cycle, stepId: step.id, rowId: entry.rowId, time: state.time, before, afterCast: snapshot(), damage: 0, valid: !reasons.length });
        continue;
      }
      if (invalid.has(event.actionKey)) continue;
      if (event.kind === "recover") {
        if (skill.type === "heavy" && finite(skill.spRecovery)) restoreSp(skill.spRecovery);
        restoreSp(input.restoreSp); restoreSp(input.refundSp, true); gainEnergy(actorId, input.selfEnergy);
        mechanics?.onEvent("action-end", { ...entry, cycle:event.cycle });
      }
      if (event.kind === "buff") {
        const buff = event.buff;
        const group = String(buff.group || `${actorId}:${step.skillKey}:${buff.kind}`);
        const target = buff.target === "self" ? actorId : "team";
        state.buffs = state.buffs.filter((active) => !(active.group === group && active.target === target));
        state.buffs.push({ group, kind: buff.kind, value: number(buff.value, 0), target, element: buff.element || "all", until: state.time + number(buff.duration, 0) });
      }
      if (event.kind === "damage") {
        mechanics?.onEvent("hit", { ...entry, hit: event.hit, cycle:event.cycle, damageResolved:!resourcesOnly });
        if (resourcesOnly) continue;
        const sums = {};
        for (const buff of state.buffs) if ((buff.target === "team" || buff.target === actorId) && (buff.element === "all" || buff.element === event.hit.element)) sums[buff.kind] = (sums[buff.kind] || 0) + buff.value;
        const panel = config.panels[actorId];
        const effectivePanel = { ...panel, damageBonus: (panel.damageBonus || 0) + (panel.elementBonuses?.[event.hit.element] || 0) + (panel.skillBonuses?.[step.skillKey] || 0) };
        const scale = config.panelMode === "auto" && global.AutoStats ? global.AutoStats.hitScale(memberMap.get(actorId), event.hit) : event.hit.scale;
        const value = damage(panel.attack, scale, effectivePanel, { defense: config.defense, resistance: config.resistances[event.hit.element] || 0 }, sums);
        period.damage += value;
        const row = period.rows.find((r) => r.id === entry.rowId); if (row) row.damage += value;
        const trace = actionEvents.find((a) => a.cycle === event.cycle && a.stepId === step.id); if (trace) trace.damage += value;
        mechanics?.onEvent("damage-applied", { ...entry, damage: value, hit: event.hit, cycle:event.cycle });
      }
      if (event.kind === "action-end") {
        const trace = actionEvents.find(a => a.cycle === event.cycle && a.stepId === step.id);
        if (trace) trace.afterEnd = snapshot();
      }
      } finally {if(record){record.after=snapshot();eventLedger.push(record);}}
    }
    const last = periods[periods.length - 1];
    const deficits = [];
    if (last.end.sp - last.end.refundedSp + EPS < last.start.sp - last.start.refundedSp) deficits.push("普通技力在循环末减少");
    if (Math.abs(last.end.refundedSp - last.start.refundedSp) > EPS) deficits.push("返还技力来源组成未闭合");
    for (const actorId of memberMap.keys()) if (last.end.energy[actorId] + EPS < last.start.energy[actorId]) deficits.push(`${memberMap.get(actorId).operator.name}的终结技能量在循环末减少`);
    for (const key of new Set([...Object.keys(last.start.cooldowns), ...Object.keys(last.end.cooldowns)])) if ((last.end.cooldowns[key] || 0) > (last.start.cooldowns[key] || 0) + EPS) deficits.push(`${key} 冷却余量未闭合`);
    for (const key of new Set([...Object.keys(last.start.locks), ...Object.keys(last.end.locks)])) if ((last.end.locks[key] || 0) > (last.start.locks[key] || 0) + EPS) deficits.push(`${key} 充能锁未闭合`);
    if (last.end.regenPause > last.start.regenPause + EPS) deficits.push("技力恢复暂停未闭合");
    const buffDigest = (snapshot) => JSON.stringify(snapshot.buffs.map((b) => ({ ...b, remaining: Math.round(b.remaining * 10000) / 10000 })).sort((a, b) => `${a.group}:${a.target}`.localeCompare(`${b.group}:${b.target}`)));
    if (buffDigest(last.start) !== buffDigest(last.end)) deficits.push("增益状态在循环边界尚未闭合");
    deficits.push(...(mechanics?.boundary(last.start.mechanics, last.end.mechanics) || []));
    const sustainable = resourcesComplete && !errors.length && !deficits.length;
    return { status: errors.length ? "invalid" : "modeled", scope: resourcesOnly ? "declared-resources" : "declared-direct-damage", modeledDamage: resourcesOnly ? null : periods[0].damage,
      modeledDps: resourcesOnly ? null : periods[0].damage / time, repeatedDps: resourcesOnly ? null : last.damage / time, cycleSeconds: time,
      periods, actions: actionEvents, ...(options.captureEvents?{eventLedger}:{}), rowTimes, timeline, errors, deficits, missing: [], warnings: [...warnings],
      resourcesComplete, conditionsConfirmed, resourceSustainable: !options.singlePass && sustainable,
      mechanicTrace: mechanics?.trace || [], mechanicCoverage: mechanics?.coverage || [],
      feasible: !options.singlePass && sustainable && conditionsConfirmed, optimality: "not-proven", rulesSource: config.rulesSource };
  }
  global.RotationModel = { TYPES, ELEMENTS, ELEMENT_NAMES, id, normalize, ordered, move, settings, damage, evaluate };
})(typeof window !== "undefined" ? window : self);
