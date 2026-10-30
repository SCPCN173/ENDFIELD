# 本地重放输入

Node.js 24+。运行：`node <skill目录>/scripts/run-axis.mjs <输入JSON> [输出JSON]`。只读输入；无第二参数时将JSON报告打印到标准输出。推荐由代理在任务工作目录创建输入文件，不要求普通玩家写JSON。

输入对象：

- `dataVersion`：当前一致的数据版本，例`1.6.4@11262943-8`，不要默认认为例子是最新版本。
- `members`：按队伍顺序的数组。每项至少有`operator`，其`id/name/skills`来自同版本数据。`growth/weaponId/equipmentIds`可带入养成计算；第一个成员是主控。
  施放技能对象须已经按所选养成解析到相应`level`，并有费用、CD与时长；携带`growth`但不解析技能等级会导致使用错误的逐级命中事件。
- `axis`：`phases:[{id,name,waitAfter?}]`和`steps:[{id,phaseId,operatorId,skillKey,calculation?}]`。skillKey只取heavy/skill/combo/ultimate。`calculation`存用户显式高级校准时的值，普通用户不需填。
- `damageProfilesPath`：同版本、已编译的命中事件JSON文件路径；缺失则不能给完整直伤。
- `numericDataPath`：同版本、已编译的角色/武器/装备数值JSON路径。缺失时，除非轴有可信面板数据，否则无法计算伤害。不能让用户填一个猜测攻击力。
- `mechanicRegistryPath`：可选的来源身份记录；公开版不附干员专属适配器，不执行该包内声明的机制。即使提供也不能据此认证特殊机制。

路径由调用者选择，脚本不自动读取其他目录、不联网、不运行游戏程序。所有包须同版本。来源包由当前任务合法获得并记录原始URL/哈希；不要引用或传播未经许可的游戏客户端素材。输出包含包SHA256、参数问题、事件和每轮账本以及模型限制。

`status`三层：`incomplete`表示模型不能完整求值；`invalid`表示存在不可执行动作；`modeled`只表示当前声明事件可重放。`feasible`仅指已声明的资源/条件闭合，不能单独推断实战成功。公开版没有专属适配器，包装报告的`certification`始终为`unverified`，即使内部模型给出数值。
