//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "hardhat/console.sol";

interface IFlashLoanEtherReceiver {
    function execute(uint256 fee) external payable;
}

/*is ReentrancyGuard*/
contract SecureLenderPool is VRFConsumerBase, ReentrancyGuard {
    uint256 public feePercent = 1;
    uint256 positionAmount = 1 ether / 4;
    uint256 public positionCount;
    bytes32 internal keyHash;
    uint256 internal fee;
    uint256 public randomResult;
    address public owner;
    // address -> array that contains where users positions are located in the positionToDepositor mapping
    mapping(address => uint256[]) public positionLocations;
    // position -> depositor
    mapping(uint256 => address) public positionToDepositor;

    constructor()
        VRFConsumerBase(
            0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9, // VRF Coordinator
            0xa36085F69e2889c224210F603D836748e7dC0088 // LINK Token
        )
    {
        keyHash = 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4;
        fee = 0.1 * 10**18; // 0.1 LINK
    }

    function setFeePercent(uint256 _percent) external {
        require(msg.sender == owner, "Only owner");
        feePercent = _percent;
    }

    function deposit() external payable nonReentrant {
        require(
            msg.value <= 100 ether,
            "Can't deposit more than 100 ether at a time"
        );
        require(msg.value > 0, "Deposit must be greater than zero");
        require(
            msg.value % positionAmount == 0,
            "Error, deposit value must be an interval of the position amount"
        );
        uint256 _positionCount = positionCount;
        uint256 _deposits;
        while (_deposits < msg.value / positionAmount) {
            _deposits++;
            positionLocations[msg.sender].push(_positionCount + _deposits);
            positionToDepositor[_positionCount + _deposits] = msg.sender;
        }
        positionCount += _deposits;
    }

    function withdraw(uint256 _amountOfPositions) external nonReentrant {
        require(
            _amountOfPositions <= positionLocations[msg.sender].length,
            "Insufficient deposit balance"
        );
        uint256 _positionCount = positionCount;

        uint256[] memory _positions = new uint256[](
            positionLocations[msg.sender].length
        );

        _positions = positionLocations[msg.sender];

        for (uint256 i = 0; i < _amountOfPositions; i++) {
            address shiftedAddr = positionToDepositor[_positionCount - i];
            uint256 shift = _positions[_positions.length - (1 + i)];
            positionToDepositor[shift] = shiftedAddr;
            for (
                uint256 j = 0;
                j < positionLocations[shiftedAddr].length;
                j++
            ) {
                if (positionLocations[shiftedAddr][j] == _positionCount - i) {
                    positionLocations[shiftedAddr][j] = shift;
                    break;
                }
            }
        }

        uint256[] memory _remainingPositions = new uint256[](
            _positions.length - _amountOfPositions
        );

        for (uint256 i = 0; i < _remainingPositions.length; i++) {
            _remainingPositions[i] = _positions[i];
        }

        positionLocations[msg.sender] = _remainingPositions;
        positionCount -= _amountOfPositions;

        // transfer ether
        (bool sent, ) = payable(msg.sender).call{
            value: _amountOfPositions * positionAmount
        }("");
        require(sent, "Failed to send Ether");
    }

    function getBalance(address _depositor) external view returns (uint256) {
        return (positionLocations[_depositor].length * positionAmount);
    }

    function getFee(uint256 _borrowAmount) public view returns (uint256) {
        return (_borrowAmount * (feePercent)) / 100;
    }

    function flashLoan(address borrowingContract, uint256 amount)
        external
        nonReentrant
    {
        require(
            LINK.balanceOf(address(this)) > fee,
            "Not enough LINK - fill contract with faucet"
        );
        uint256 balanceBefore = address(this).balance;
        require(balanceBefore >= amount, "Not enough ETH in balance");
        // Get random number from chainlink
        requestRandomness(keyHash, fee);
        // Get fee
        uint256 _fee = getFee(amount);
        // Lend funds to recieving contract
        IFlashLoanEtherReceiver(borrowingContract).execute{value: amount}(_fee);
        require(
            address(this).balance >= balanceBefore + _fee,
            "Flash loan hasn't been paid back"
        );
        // Pay fee to one of the depositors.
        // We get the lucky depositer using the positionToDeposit mapping, looking up the depositor at a random position.
        payable(positionToDepositor[(randomResult % positionCount) + 1])
            .transfer(_fee);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32, uint256 randomness) internal override {
        randomResult = randomness;
    }

    // Required to receieve fees
    receive() external payable {}
}
