# MonadFLIP

**Post a price, get it beaten, pay for the savings — on-chain, in under a second.**

MonadFLIP is a bounty market for deals. You escrow MON against a reference price for an
item; anyone who finds it cheaper submits an oracle-verified link, instantly earns a share
of the savings, and walks away with an on-chain **Deal Proof** NFT. The rest of your escrow
refunds automatically.

## The problem

Finding the best price is unpaid labor. Deal hunters do the work; retailers and aggregators
capture the value. There's no trustless way to say *"I'll pay you a cut of whatever you save
me"* and have it settle instantly, with proof. MonadFLIP makes the savings itself the reward
and settles it the moment a cheaper price is verified.

## How it works

1. **Post a bounty** — `createBounty(item, refPriceCents, sharePct, expiry)` escrows MON
   against a reference price (e.g. AirPods, $249.00, 20% share).
2. **Find a deal** — a hunter submits a cheaper link. An off-chain oracle fetches the page,
   confirms the price, and signs it.
3. **Submit on-chain** — `submitDeal(id, url, priceCents, oracleSig)` verifies the oracle's
   signature, then in one transaction:
   - pays the finder their share of the savings,
   - refunds the remainder to the poster,
   - mints a **Deal Proof** ERC-721 (on-chain JSON metadata) to the finder.
4. **No deal? Refund** — after `expiry`, the poster calls `refund(id)` to reclaim the escrow.

### Payout math

```
savingsCents = refPriceCents - foundPriceCents
payout       = escrow * sharePct * savingsCents / (100 * refPriceCents)   // to finder
refund       = escrow - payout                                           // to poster
```

Example (demo): $249 reference, 20% share, found at $189 → **$60 saved, finder earns $12**
(1200/24900 of the escrow); the poster gets the rest back. The finder's NFT records the item,
reference price, found price, savings, and payout.

### The oracle signature

The oracle signs `keccak256(abi.encodePacked(id, url, priceCents, block.chainid, address(this)))`
with EIP-191 (personal_sign over the raw 32-byte digest). The contract recovers the signer with
OpenZeppelin `ECDSA` + `MessageHashUtils` and requires it to equal the oracle baked in at deploy.
Binding `chainid` and the contract address into the digest prevents replay across chains or
deployments. Full integration notes are in [`DYLAN_HANDOFF.md`](./DYLAN_HANDOFF.md).

## Monad features used

- **Sub-second finality** — the headline demo: a finder submits a link and the payout +
  NFT mint land in well under a second. The savings settle as fast as a card swipe.
- **Full EVM equivalence** — built with standard Foundry + OpenZeppelin v5; no custom
  tooling needed to deploy to Monad testnet (chain **10143**).
- **Cheap, high-throughput execution** — low gas keeps the finder's cut from being eaten by
  fees, and makes many small bounties/submissions economical, which is the point of a deal market.

## Contract

| | |
|---|---|
| Contract | `DealBounty` |
| Address | `0x629751D83702E11FFbB84a44fE9990a5E36B4501` |
| Chain | Monad testnet (chainId 10143) |
| Explorer | https://testnet.monadexplorer.com/address/0x629751D83702E11FFbB84a44fE9990a5E36B4501 |
| Deploy tx | [`0x2188…e0d8`](https://testnet.monadexplorer.com/tx/0x2188f9f9f3f7245abde28eb50b57c2401aaecc07b35707378994ccb2043ce0d8) |
| ABI | [`abi/DealBounty.abi.json`](./abi/DealBounty.abi.json) |

### Interface

```solidity
createBounty(string item, uint256 refPriceCents, uint8 sharePct, uint64 expiry) payable // -> id
submitDeal(uint256 id, string url, uint256 priceCents, bytes oracleSig)
refund(uint256 id)
```

## Build & test

```bash
forge install           # forge-std + openzeppelin-contracts
forge test -vv          # 8 tests: valid deal, bad sig, price>=ref, refund-after-expiry, + extras
```

## Deploy

```bash
cp .env.example .env    # set ORACLE_ADDRESS, PRIVATE_KEY, MONAD_RPC_URL  (.env is gitignored)
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
```

## Repo layout

```
src/DealBounty.sol        the contract
test/DealBounty.t.sol     Foundry tests
script/Deploy.s.sol       deploy script
abi/DealBounty.abi.json   ABI for the frontend/oracle
DYLAN_HANDOFF.md          signing recipe + integration notes
```
