# EIP-7702

## 核心思想：

- 允许用户的普通外部账户（EOA，Externally Owned Account）在某一笔交易内，**临时“变身”成智能合约账户**，以执行更复杂的逻辑（如批量操作、签名验证、授权等）。
- 交易执行结束后，这个账户又恢复成普通 EOA，不保留合约状态。

## EIP-7702的设计

交易结构变化：

EIP-7702在普通交易的基础上引入两个字段：

```solidity
bytes code      // 临时部署到 sender 地址的代码
bytes32 stateHash // 表示状态的 root hash（用于验证状态的一致性）
```

执行流程：

1. 交易进来之后，先判断`sender`是否为`EOA`
2. 如果`code.length > 0`：
   - 在执行前临时将`code`写入`sender`地址（setCode操作）
   - 接下来该地址会被视为一个合约账户进行处理（如验证、执行等）
3. 交易执行完后，会自动移除这个临时代码

**最终达到让EOA临时变成合约账户的目的**

# create&create2&联合攻击

create生成地址的方式：`keccak256(sender, nonce)`

地址无法预测，除非控制nonce

create2生成地址的方式：`keccak256(0xFF, sender, salt, keccak256(init_code))`

地址可预测，由salt和code决定

攻击核心思想：

利用create2可以提前预知地址+create动态部署地址，制造地址碰撞，抢先部署，initcode钓鱼等攻击

## 1.提前占位攻击

在某协议依赖用户创建钱包时生成的地址用于白名单、空投、投票权分配等。

攻击思路：

1. 攻击者使用create2构造出一个目标地址A（还未部署）
2. 用来诱导协议提前将资源分配给A
3. 知道关键时刻（比如领取空投），攻击者再通过create2精确部署钱包到A
4. 领取利益后，合约甚至自毁，重复再来

**==DeFi协议中有些DAO/分发机制会只看地址，不判断地址是否是合约/EOA==**

## 2.create+create2联合部署碰撞攻击

攻击者想要部署一个合约B，但B的构造逻辑或代码过长，可能部署失败或成本太高

利用方式：

1. 用create2精确部署一个工厂合约Factory

2. 在这个Factory合约里，使用create部署Target

3. 最终合约Target的地址将变成：

   ```solidity
   address = keccak256(RLP(factory_address, factory_nonce))
   ```

攻击目标：

- 使最终Target地址撞上一个用户未初始化的钱包地址（例如某些智能钱包initcode固定，地址predictable）
- 或者部署在一个项目会自动信任的地址上

## 3.沙箱逃逸/重部署漏洞

利用合约自毁+create2可重用地址

1. 攻击者部署合约X到地址A（通过create2）
2. 交互获得权限/通过验证
3. X自毁
4. 再通过相同salt、init_code在地址A上部署不同代码逻辑的合约

目标是骗过只判断地址，不判断代码哈希的访问控制系统（如delegatecall白名单）

## 4.initcode钓鱼攻击

在 Account Abstraction（账户抽象）/ERC-4337 场景中：

- 用户的钱包地址未部署，但地址由create2决定
- initcode会被打包到userOp中，由bundler帮助部署

攻击手法：

1. 攻击者设置一个恶意initcode，将合约地址设为跟用户计划中相同的create2地址
2. 由于地址一致，协议/relayer可能会信任该合约
3. 用户一旦授权，资金被盗

# ERC-4337

**ERC-4337** 是一种“**无需修改底层协议**”的方式，让普通用户使用“智能合约钱包”代替传统的 EOA

这个智能钱包与EOA对比，是一个合约，可自定义签名算法，支持多签，gas可由别人代付，

ERC-4337 是“现在能用的账户抽象”方案，基于合约逻辑实现；EIP-7702 是未来“协议层支持账户抽象”的轻量升级。两者目标一致，EIP-7702 甚至可视为 ERC-4337 的“理想形态简化版”。