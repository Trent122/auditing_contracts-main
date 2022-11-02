# Auditing Contracts

## About

- Learn about common pitfalls when coding in solidity!
- There are two lender pool contracts in this project, a secure one and a vulnerable one.
- The vulnerable one contains 5 vulnerabilites.  
- These are 5 of the most common vulnerabilites found in smart contract audit reports.
- The secure one fixes all of these vulnerabilites.

## Technology Stack & Tools

- Solidity (Writing Smart Contract)
- Javascript (Testing)
- [Ethers](https://docs.ethers.io/v5/) (Blockchain Interaction)
- [Hardhat](https://hardhat.org/) (Development Framework)

## Requirements For Initial Setup
- Install [NodeJS](https://nodejs.org/en/), should work with any node version below 16.5.0
- Install [Hardhat](https://hardhat.org/)

## Setting Up
### 1. Clone/Download the Repository

### 2. Install Dependencies:
```
$ cd hack_smart_contracts
$ npm install 
```

### 3. Run Pitfalls test
`$ npx hardhat test`
