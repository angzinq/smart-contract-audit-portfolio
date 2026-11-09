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
