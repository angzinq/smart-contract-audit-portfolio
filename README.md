# Smart Contract Security Portfolio

> 区块链工程专业学生的链上安全练习记录：靶场通关、CTF 题解、机制笔记、工程项目。
> 目标岗位：**智能合约审计工程师**（DeFi 协议 / 跨链桥方向）。

## 关于我

- 区块链工程专业，2024 级（2028 届本科）
- 方向：智能合约审计
- 现状：有靶场与工程积累，正在把"能打穿"变成"能交付"

## 仓库导航

| 目录 | 内容 | 规模 |
|---|---|---|
| [01-ethernaut](01-ethernaut/) | OpenZeppelin Ethernaut 靶场，每关含成因分析与攻击脚本 | 11 关 |
| [02-damn-vulnerable-defi](02-damn-vulnerable-defi/) | Damn Vulnerable DeFi 题解，DeFi 真实漏洞模式 | 4 关 |
| [03-ctf-writeups](03-ctf-writeups/) | 校赛、课程考核与练习题的完整题解 | 11 份 |
| [04-notes](04-notes/) | 账户抽象、CREATE2、EVM gas 等机制笔记 | 2 篇 |
| [05-projects](05-projects/) | NFT 市场 DApp、跨链身份认证方案 | 2 个 |
| [06-audit-reports](06-audit-reports/) | 按客户标准撰写的审计报告 | 进行中 |

## 能力 → 证据

| 岗位要求 | 对应的证据 | 位置 |
|---|---|---|
| 读得懂复杂合约 | 11 关靶场 + 真实协议题解，覆盖 delegatecall、存储布局、代理与克隆 | 01 / 03 |
| 找得到常见漏洞 | 重入、权限、预言机操纵、治理攻击、selfdestruct、gas DoS | 01 / 02 |
| 能复现攻击 | 攻击脚本内嵌在每关 writeup 里，复制进 Foundry 即可重放 | 01 / 02 |
| 写过合约 | NFT 市场合约 + 11KB 单元测试 | 05 |
| 懂跨链与密码学 | 格基动态群签名的跨链身份认证方案 | 05 |
| 能写清楚 | 11 份 Writeup（md + pdf），审计报告按客户标准推进中 | 全部 |

## 正在做

- [ ] 5 份标准审计报告（见 [06-audit-reports](06-audit-reports/)）
- [ ] 主网 fork 上的 3 类组合攻击复现
- [ ] Code4rena / Sherlock 首条有效提交

## 约定与免责

- 题目合约版权归原作者（OpenZeppelin、Damn Vulnerable DeFi、比赛主办方），本仓库仅收录**解题过程与笔记**。
- 所有实验均在**本地 Anvil 或测试网**完成，不涉及任何真实资产，也不针对任何未授权系统。
- Writeup 仅用于学习交流，涉及比赛的均在赛后公开；如主办方有异议，我会立即撤下对应内容。
- 仓库内不含任何私钥、助记词或 API Key。
- **收录标准：只放有完整证据链的内容**（能复现的攻击、能跑通的脚本、能核对的数据）；
  只有结论没有 PoC 的，宁可不放，等补齐再加。
