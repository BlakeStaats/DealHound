// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DealBounty} from "../src/DealBounty.sol";

/// @notice Deploy DealBounty to Monad testnet (chain 10143).
/// Requires env: ORACLE_ADDRESS, PRIVATE_KEY.
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --verify
contract Deploy is Script {
    function run() external returns (DealBounty deal) {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        deal = new DealBounty(oracle);
        vm.stopBroadcast();

        console2.log("DealBounty deployed at:", address(deal));
        console2.log("Oracle set to:", oracle);
        console2.log("Chain id:", block.chainid);
    }
}
