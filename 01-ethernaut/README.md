# 01 · Ethernaut 靶场

Ethernaut 是 OpenZeppelin 出的 EVM 闯关靶场，每一关都是一个被故意写错的合约。
我完成 **11 关**，每关都写了：漏洞成因 → 攻击思路 → Foundry 攻击脚本 → 修复方向。
攻击脚本以代码块形式内嵌在 writeup 中，复制到 Foundry 项目即可运行。

| # | 关卡 | 漏洞类型 |
|---|---|---|
| 1 | Fallback | fallback 函数与所有权 |
| 2 | Fallout | 构造器写法错误导致的初始化劫持 |
| 3 | Telephone | `tx.origin` 钓鱼 |
| 4 | Vault | 私有变量并非真的私有（storage slot） |
| 5 | Privacy | 存储布局与 `bytes32` 槽位读取 |
| 6 | Delegation | `delegatecall` 与存储槽冲突 |
| 7 | Force | `selfdestruct` 强制转账，绕过 `receive` |
| 8 | King | 转账失败导致的状态机 DoS |
| 9 | Denial | 外部调用中的 gas 消耗型 DoS |
| 10 | GatekeeperTwo | 修饰器绕过：`extcodesize` 与构造期调用 |
| 11 | GatekeeperThree | 复合条件与权限链（构造函数、`tx.origin`、余额） |

每个关卡目录下同名 `.md` 是完整过程，`.pdf` 是导出稿。
