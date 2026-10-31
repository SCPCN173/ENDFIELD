---
name: endfield-combat
description: Analyze Arknights Endfield operator combat mechanics, loadouts, rotation resources and modeled direct-hit damage with source-aware local replay. Use for Endfield team rotations or DPS questions; not for original Arknights, account login, live game automation or unsupported global-optimum claims.
---

# 终末地战斗与排轴

本文件是可供不同智能体读取的工作说明，配套脚本也可独立通过 Node.js 调用；不依赖 Codex、原项目工作目录或特定模型。

为普通玩家解释《明日方舟：终末地》的操作顺序、技力、终结能量、连携条件、冷却和已建模直伤。先用玩家给定队伍与养成；未给养成时采用干员/武器潜能0，其余默认满级、满技能与满精锻的**明确假设**。不要要求普通玩家填写攻击力、倍率、回能或技能黑板。若源数据不足，说明缺口并继续核对可确定的部分。

## 来源与等级

每次版本敏感回答先查当前数据版本与来源。可用[AKEData](https://www.akedata.wiki/)及[森空岛干员攻略](https://wiki.skland.com/endfield/catalog?mainTypeId=2&subTypeId=11&header=0)；社区打法只能提供候选顺序，不能代替数值/时序验证。原始来源可读时，记录URL、版本、干员与技能ID、养成、敌人条件和数据哈希。不要把别的版本技能参数混入当前轴。无来源时不编造数值。

对每项结论分清：原表有记录；来源规则已解释并测试；多轮循环已验证。角色被登记不等于所有专属机制都已实现。用户点名的特殊机制是通用机制类别的例子，不是固定角色白名单。

## 计算入口

需要重放时，先读[输入与命令](references/replay-input.md)，调用随skill附带的`scripts/run-axis.mjs`。脚本与库在本skill目录内工作，不依赖原项目路径、游戏登录、联网服务或外部API。实际角色数值包/动作来源由本次任务在用户可访问来源取得；本skill不附带游戏解析素材。遇到缺包、无命中、连携条件未知或机制覆盖不全，保留原样缺口，不能用0或人工勾选“触发成功”补齐。

输出“声明模型内通过资源检查”时同时说明起点、重复轮次、敌人、时长和未覆盖效果。只有重放同一完整循环并满足所声明边界的候选，才可参与已建模持续DPS比较；有界搜索不证明全局最优。打字提示、AI生成的攻略与按键观察都不是游戏中成功释放/命中的证据。

## 战斗要点

默认轴展示重击、战技、连携、终结技；主控重击的时间与伤害包含前置普攻链，普通攻击不逐卡出现。技力为全队共用，重击与时间可回技力，战技消耗技力并带来终结能量；连携有条件及CD。行只是编排分组，不能重置SP/能量/CD/buff。持续命中、姿态、召唤、箭矢、冷却减少、资源返还要进入事件与循环边界；不能用动作名称或描述关键词充当完整规则。

常驻攻击公式、名义帧和伤害模型的来源/限制见[战斗模型](references/combat-model.md)。对不完整机制直接告诉玩家“目前不能证明哪一步更优或可循环”，并给出所需证据，不指派玩家填写研究参数。只有明确需要实测时才建议可选的时间校准。
