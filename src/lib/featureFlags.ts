/* C2 命名体系收敛开关（可回退）：
   false = 隐藏 TRANSFER 页三处旧命名入口（页面「命名规则」按钮 / 行内「智能命名·智能纠错」/ SmartProcessDialog 挂载）；
   置 true 即可回退重新显示旧入口；C5 清理阶段删除本开关与对应遗留代码。
   注意：state.namingTemplate 数据结构与读写逻辑不受本开关影响（始终保留回退能力） */
export const LEGACY_NAMING_ENTRY = false
