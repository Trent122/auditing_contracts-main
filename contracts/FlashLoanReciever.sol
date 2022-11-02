// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// Hypothetically, a hacker discovers that a user of the lenderpool has
// deployed a flash loan recieving contract for the lender pool on etherscan
// He analyzes it, finds a vulnerability then tries to steal all the
// ether inside of it.
contract FlashLoanReceiver {
    address payable[2] public pools;
    address public owner;

    constructor(address payable[2] memory poolAddresses) {
        pools = poolAddresses;
        owner = msg.sender;
    }

    // Function called by the pool during flash loan
    function execute(uint256 fee) public payable {
        require(tx.origin == owner);
        require(
            msg.sender == pools[1] || msg.sender == pools[0],
            "Sender must be a pool"
        );

        uint256 amountToBeRepaid = msg.value + fee;

        require(
            address(this).balance >= amountToBeRepaid,
            "Cannot borrow that much"
        );

        _executeActionDuringFlashLoan();

        // Return funds to pool
        (bool sent, ) = msg.sender.call{value: amountToBeRepaid}("");
        require(sent, "Failed to send Ether");
    }

    // Internal function where the funds received are used
    function _executeActionDuringFlashLoan() internal {}

    // Allow deposits of ETH
    receive() external payable {}
}
