// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {DealBounty} from "../src/DealBounty.sol";

contract DealBountyTest is Test {
    DealBounty internal db;

    uint256 internal constant ORACLE_PK = 0xA11CE;
    uint256 internal constant WRONG_PK = 0xBAD;
    address internal oracle;

    address internal poster = address(0xB0B);
    address internal finder = address(0xF1);

    string internal constant URL = "https://store.example/airpods";
    uint256 internal constant REF_CENTS = 24900; // $249.00
    uint256 internal constant FOUND_CENTS = 18900; // $189.00
    uint8 internal constant SHARE_PCT = 20;
    uint256 internal constant ESCROW = 10 ether;

    function setUp() public {
        oracle = vm.addr(ORACLE_PK);
        db = new DealBounty(oracle);
        vm.deal(poster, 100 ether);
    }

    // --- helpers ---------------------------------------------------------

    function _createBounty() internal returns (uint256 id) {
        vm.prank(poster);
        id = db.createBounty{value: ESCROW}("AirPods Pro", REF_CENTS, SHARE_PCT, uint64(block.timestamp + 1 days));
    }

    function _sign(uint256 pk, uint256 id, string memory url, uint256 priceCents)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(abi.encodePacked(id, url, priceCents, block.chainid, address(db)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, MessageHashUtils.toEthSignedMessageHash(digest));
        return abi.encodePacked(r, s, v);
    }

    // --- required cases --------------------------------------------------

    /// 1. valid deal pays out and mints
    function test_ValidDealPaysOutAndMints() public {
        uint256 id = _createBounty();
        bytes memory sig = _sign(ORACLE_PK, id, URL, FOUND_CENTS);

        uint256 posterBefore = poster.balance;

        vm.prank(finder);
        db.submitDeal(id, URL, FOUND_CENTS, sig);

        // payout = escrow * sharePct * (ref - found) / (100 * ref)
        uint256 expectedPayout = (ESCROW * SHARE_PCT * (REF_CENTS - FOUND_CENTS)) / (100 * REF_CENTS);

        assertEq(finder.balance, expectedPayout, "finder payout");
        assertEq(poster.balance - posterBefore, ESCROW - expectedPayout, "poster refund");
        assertEq(address(db).balance, 0, "contract drained");
        assertEq(db.ownerOf(id), finder, "NFT minted to finder");
        assertGt(bytes(db.tokenURI(id)).length, 0, "tokenURI present");
    }

    /// 2. bad signature reverts
    function test_BadSignatureReverts() public {
        uint256 id = _createBounty();
        bytes memory badSig = _sign(WRONG_PK, id, URL, FOUND_CENTS);

        vm.prank(finder);
        vm.expectRevert(DealBounty.BadSignature.selector);
        db.submitDeal(id, URL, FOUND_CENTS, badSig);
    }

    /// 3. price >= ref reverts
    function test_PriceAtOrAboveRefReverts() public {
        uint256 id = _createBounty();
        bytes memory sig = _sign(ORACLE_PK, id, URL, REF_CENTS); // price == ref

        vm.prank(finder);
        vm.expectRevert(DealBounty.PriceNotBelowRef.selector);
        db.submitDeal(id, URL, REF_CENTS, sig);
    }

    /// 4. refund after expiry works
    function test_RefundAfterExpiry() public {
        uint256 id = _createBounty();
        vm.warp(block.timestamp + 2 days);

        uint256 posterBefore = poster.balance;
        vm.prank(poster);
        db.refund(id);

        assertEq(poster.balance - posterBefore, ESCROW, "full escrow refunded");
        assertEq(address(db).balance, 0, "contract drained");
    }

    // --- extra safety nets ----------------------------------------------

    function test_RefundBeforeExpiryReverts() public {
        uint256 id = _createBounty();
        vm.prank(poster);
        vm.expectRevert(DealBounty.NotExpiredYet.selector);
        db.refund(id);
    }

    function test_DoubleSubmitReverts() public {
        uint256 id = _createBounty();
        bytes memory sig = _sign(ORACLE_PK, id, URL, FOUND_CENTS);

        vm.prank(finder);
        db.submitDeal(id, URL, FOUND_CENTS, sig);

        vm.prank(finder);
        vm.expectRevert(DealBounty.BountyNotOpen.selector);
        db.submitDeal(id, URL, FOUND_CENTS, sig);
    }

    function test_SubmitAfterExpiryReverts() public {
        uint256 id = _createBounty();
        bytes memory sig = _sign(ORACLE_PK, id, URL, FOUND_CENTS);
        vm.warp(block.timestamp + 2 days);

        vm.prank(finder);
        vm.expectRevert(DealBounty.BountyExpired.selector);
        db.submitDeal(id, URL, FOUND_CENTS, sig);
    }

    /// Matches the demo script: $249 ref, 20% share, $189 find -> finder earns $12 of $249.
    function test_DemoNumbers_FinderEarnsShareOfSavings() public {
        uint256 id = _createBounty();
        bytes memory sig = _sign(ORACLE_PK, id, URL, FOUND_CENTS);

        vm.prank(finder);
        db.submitDeal(id, URL, FOUND_CENTS, sig);

        // $12 of a $249 escrow => 1200/24900 of 10 ether.
        uint256 expected = (ESCROW * 1200) / 24900;
        assertEq(finder.balance, expected, "finder earns 12/249 of escrow");
    }
}
