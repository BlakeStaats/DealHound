// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title DealBounty — MonadFLIP
/// @notice Post a bounty with escrowed MON for a reference price. A finder submits a
///         cheaper verified price (signed by the oracle), earns a share of the savings,
///         and receives a "Deal Proof" ERC-721. The remaining escrow refunds to the poster.
/// @dev Interface is frozen (agreed with the oracle/frontend author). Do not change
///      createBounty / submitDeal / refund signatures or the signed message layout
///      without telling the other person.
contract DealBounty is ERC721 {
    using Strings for uint256;

    enum Status {
        Open,
        Filled,
        Refunded
    }

    struct Bounty {
        address poster;
        uint64 expiry;
        uint8 sharePct;
        Status status;
        uint256 refPriceCents;
        uint256 escrow;
        // filled-in details (used for the NFT metadata)
        address finder;
        uint256 foundPriceCents;
        uint256 payout;
        string item;
        string url;
    }

    /// @notice Oracle whose signature authorizes a submitted deal price.
    address public immutable oracle;

    uint256 public nextId;
    mapping(uint256 => Bounty) public bounties;

    event BountyCreated(
        uint256 indexed id,
        address indexed poster,
        string item,
        uint256 refPriceCents,
        uint8 sharePct,
        uint64 expiry,
        uint256 escrow
    );
    event DealSubmitted(
        uint256 indexed id,
        address indexed finder,
        uint256 priceCents,
        uint256 payout,
        uint256 refundToPoster
    );
    event Refunded(uint256 indexed id, address indexed poster, uint256 amount);

    error InvalidSharePct();
    error InvalidExpiry();
    error NoEscrow();
    error InvalidRefPrice();
    error BountyNotOpen();
    error BountyExpired();
    error PriceNotBelowRef();
    error BadSignature();
    error NotExpiredYet();
    error NotPoster();
    error TransferFailed();

    constructor(address _oracle) ERC721("MonadFLIP Deal Proof", "DEAL") {
        require(_oracle != address(0), "oracle=0");
        oracle = _oracle;
    }

    /// @notice Post a bounty, escrowing MON that corresponds to `refPriceCents`.
    /// @param item          Human-readable item name (e.g. "AirPods Pro").
    /// @param refPriceCents Reference price in US cents (e.g. 24900 == $249.00).
    /// @param sharePct      Finder's share of the savings, 1..100.
    /// @param expiry        Unix timestamp after which the poster may refund.
    function createBounty(string calldata item, uint256 refPriceCents, uint8 sharePct, uint64 expiry)
        external
        payable
        returns (uint256 id)
    {
        if (sharePct == 0 || sharePct > 100) revert InvalidSharePct();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (msg.value == 0) revert NoEscrow();
        if (refPriceCents == 0) revert InvalidRefPrice();

        id = nextId++;
        Bounty storage b = bounties[id];
        b.poster = msg.sender;
        b.item = item;
        b.refPriceCents = refPriceCents;
        b.sharePct = sharePct;
        b.expiry = expiry;
        b.escrow = msg.value;
        b.status = Status.Open;

        emit BountyCreated(id, msg.sender, item, refPriceCents, sharePct, expiry, msg.value);
    }

    /// @notice Submit a verified cheaper price for a bounty. Pays the finder their share of
    ///         the savings, refunds the rest to the poster, and mints the Deal Proof NFT.
    /// @dev Oracle must sign keccak256(abi.encodePacked(id, url, priceCents, block.chainid,
    ///      address(this))) with EIP-191 (personal_sign over the 32-byte digest).
    function submitDeal(uint256 id, string calldata url, uint256 priceCents, bytes calldata oracleSig) external {
        Bounty storage b = bounties[id];
        if (b.status != Status.Open) revert BountyNotOpen();
        if (block.timestamp > b.expiry) revert BountyExpired();
        if (priceCents >= b.refPriceCents) revert PriceNotBelowRef();

        bytes32 digest = keccak256(abi.encodePacked(id, url, priceCents, block.chainid, address(this)));
        address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), oracleSig);
        if (signer != oracle) revert BadSignature();

        uint256 escrow = b.escrow;
        // payout = sharePct% of (refPrice - foundPrice), scaled to the escrowed MON.
        uint256 payout = (escrow * b.sharePct * (b.refPriceCents - priceCents)) / (100 * b.refPriceCents);
        uint256 refundToPoster = escrow - payout;

        // effects before interactions
        b.status = Status.Filled;
        b.finder = msg.sender;
        b.foundPriceCents = priceCents;
        b.payout = payout;
        b.url = url;
        b.escrow = 0;

        _safeMint(msg.sender, id);

        (bool okFinder,) = payable(msg.sender).call{value: payout}("");
        if (!okFinder) revert TransferFailed();
        if (refundToPoster > 0) {
            (bool okPoster,) = payable(b.poster).call{value: refundToPoster}("");
            if (!okPoster) revert TransferFailed();
        }

        emit DealSubmitted(id, msg.sender, priceCents, payout, refundToPoster);
    }

    /// @notice After expiry, the poster reclaims the full escrow of an unfilled bounty.
    function refund(uint256 id) external {
        Bounty storage b = bounties[id];
        if (b.status != Status.Open) revert BountyNotOpen();
        if (block.timestamp <= b.expiry) revert NotExpiredYet();
        if (msg.sender != b.poster) revert NotPoster();

        uint256 amount = b.escrow;
        b.escrow = 0;
        b.status = Status.Refunded;

        (bool ok,) = payable(b.poster).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Refunded(id, b.poster, amount);
    }

    /// @notice On-chain base64 JSON metadata for a Deal Proof token.
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        Bounty storage b = bounties[id];
        uint256 savings = b.refPriceCents - b.foundPriceCents;

        string memory json = string.concat(
            '{"name":"Deal Proof #',
            id.toString(),
            " - ",
            b.item,
            '","description":"Verified deal found on MonadFLIP.",',
            '"attributes":[',
            '{"trait_type":"Item","value":"',
            b.item,
            '"},',
            '{"trait_type":"Reference Price (cents)","value":',
            b.refPriceCents.toString(),
            "},",
            '{"trait_type":"Found Price (cents)","value":',
            b.foundPriceCents.toString(),
            "},",
            '{"trait_type":"Savings (cents)","value":',
            savings.toString(),
            "},",
            '{"trait_type":"Finder Share (%)","value":',
            uint256(b.sharePct).toString(),
            "},",
            '{"trait_type":"Finder Payout (wei)","value":"',
            b.payout.toString(),
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
