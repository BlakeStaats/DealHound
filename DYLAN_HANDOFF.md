# DealBounty → Dylan handoff

## Addresses
- **Contract:** `0x629751D83702E11FFbB84a44fE9990a5E36B4501`
- **Explorer:** https://testnet.monadexplorer.com/address/0x629751D83702E11FFbB84a44fE9990a5E36B4501
- **Chain:** Monad testnet, chainId **10143**
- **Oracle (signer):** `0xC6984Cbe2b76bEbb00C922C48917111C0CaE7466` (baked in at deploy, immutable)
- **ABI:** `abi/DealBounty.abi.json`

> Demo setup: the oracle signer `0xC698…7466` is the same key that deployed and will post the
> test bounties. Dylan's `POST /quote` **must sign with this exact key** or `submitDeal` reverts
> with `BadSignature`.

## Frozen interface
```solidity
createBounty(string item, uint256 refPriceCents, uint8 sharePct, uint64 expiry) payable  // returns uint256 id
submitDeal(uint256 id, string url, uint256 priceCents, bytes oracleSig)
refund(uint256 id)
```

## The signature — THIS is the 1:00 checkpoint, get it exact
The contract recovers the signer from:
```
digest  = keccak256(abi.encodePacked(id, url, priceCents, block.chainid, address(this)))
message = EIP-191:  "\x19Ethereum Signed Message:\n32" || digest   // i.e. personal_sign / signMessage over the 32-byte digest
```
and requires `recover(message) == oracle`.

### Oracle side (viem)
```ts
import { encodePacked, keccak256 } from "viem";

const digest = keccak256(
  encodePacked(
    ["uint256", "string", "uint256", "uint256", "address"],
    [id, url, priceCents, 10143n, CONTRACT_ADDRESS]
  )
);
// sign the RAW 32 BYTES, not the hex string:
const sig = await account.signMessage({ message: { raw: digest } });
```

### Oracle side (ethers v6)
```ts
const digest = ethers.solidityPackedKeccak256(
  ["uint256", "string", "uint256", "uint256", "address"],
  [id, url, priceCents, 10143, CONTRACT_ADDRESS]
);
const sig = await wallet.signMessage(ethers.getBytes(digest)); // getBytes => signs raw 32 bytes
```

**Gotchas that will silently fail the sig check:**
- Signing the hex *string* instead of the raw 32 bytes (`{ raw: digest }` / `getBytes`). Most common bug.
- Wrong field order or types — must be exactly `(uint256 id, string url, uint256 priceCents, uint256 chainid, address contract)`.
- `priceCents` and `id` are integers in cents / the bounty id, not strings.
- Signing with a key whose address != the `oracle` baked into the contract.

## Payout math
```
savingsCents = refPriceCents - priceCents
payout       = escrow * sharePct * savingsCents / (100 * refPriceCents)   // to finder (msg.sender)
refund       = escrow - payout                                           // back to poster
```
Demo check: $249 ref, 20% share, $189 find → finder gets 1200/24900 of the escrow, poster gets the rest. NFT (tokenId == bounty id) mints to the finder with on-chain base64 JSON metadata.

## Reverts to handle in the UI
`BountyNotOpen`, `BountyExpired`, `PriceNotBelowRef`, `BadSignature`, `NotExpiredYet`, `NotPoster`.
