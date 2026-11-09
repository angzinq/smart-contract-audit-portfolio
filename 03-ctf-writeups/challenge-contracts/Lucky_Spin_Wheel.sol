// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract Lucky_Spin_Wheel {

    uint public payoutMileStone1 = 0.3 ether;
    uint public mileStone1Reward = 0.2 ether;
    uint public payoutMileStone2 = 0.5 ether;
    uint public mileStone2Reward = 0.3 ether;
    uint public finalMileStone = 1 ether;
    uint public finalReward = 0.5 ether;
    bool public isGameComplete = false;
    mapping(address => uint) redeemableEther;

    constructor() payable {}

    function play() external payable {
        require(msg.value == 0.05 ether); 

        require(address(this).balance <= finalMileStone);
        
        if (address(this).balance == payoutMileStone1) {
            redeemableEther[msg.sender] += mileStone1Reward;
        }
        else if (address(this).balance == payoutMileStone2) {
            redeemableEther[msg.sender] += mileStone2Reward;
        }
        else if (address(this).balance == finalMileStone ) {
            redeemableEther[msg.sender] += finalReward;
            isGameComplete = true;
        }
        return;
    }
    function withdraw() external {
        require(isGameComplete,"YOU FAILED");
        require(redeemableEther[msg.sender] > 0,"YOU HAVE NO REWARD");
        uint256 amount = address(this).balance;
        redeemableEther[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function isSolved() external view returns (bool) {
        require(address(this).balance == 0,"Try again");
        return isGameComplete;
    }
}