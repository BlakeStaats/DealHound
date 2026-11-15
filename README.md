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

**Blake / frontend:** the oracle signs the exact `url` string. Submit `url` from `/api/quote` unchanged on-chain or the signature check fails.

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

## Web app (oracle + marketplace)

```bash
cd web
cp .env.example .env.local   # fill ORACLE_PRIVATE_KEY + ORACLE_ADDRESS (+ CONTRACT_ADDRESS)
npm ci
npm run dev
```

Generate a throwaway oracle key:

```bash
node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts'); const pk=generatePrivateKey(); console.log(pk, privateKeyToAccount(pk).address)"
```

### Environment variables (`web/`)

| Variable | Purpose |
|---|---|
| `ORACLE_PRIVATE_KEY` | Hex private key used to sign quotes |
| `ORACLE_ADDRESS` | Address of that key (checked by `npm run verify`) |
| `CONTRACT_ADDRESS` | MonadFLIP bounty contract (`address(this)` in the hash) |
| `RPC_URL` / `MONAD_RPC_URL` | RPC for server-side bounty reads (`GET /api/bounties`) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Same contract, exposed to the browser |
| `NEXT_PUBLIC_MONAD_RPC_URL` | Browser RPC (defaults to public Monad testnet RPC) |
| `CHAIN_ID` | `10143` (Monad testnet) |
| `ALLOWED_HOSTS` | Comma-separated hosts `/api/quote` may fetch (Vercel deployment URLs are added automatically) |
| `HUNTER_PRIVATE_KEY` | Wallet key for `npm run hunter` (never commit) |
| `HUNTER_BASE_URL` | Base URL the hunter bot polls (default `http://localhost:3000`) |

Never commit `.env.local`.

### API

#### `GET /api/oracle`

Returns oracle config (no secrets).

#### `GET /api/bounties`

Open, unexpired bounties from the contract (`nextId` + `bounties(i)`).

#### `POST /api/quote`

Request: `{ "bountyId": "42", "url": "http://localhost:3000/stores/dealdepot" }`

Demo store prices (cents): VoltMart `22900`, Redline Goods `20900`, DealDepot `18900`.

Bot integration notes: [`/agents`](./web/app/agents/page.tsx) (served at `/agents` when the app is running).

### Verify locally

With `npm run dev` running:

```bash
cd web
npm run verify
```

Expect `PASS`.

## Demo runbook & current testnet state

Contract `0x629751D83702E11FFbB84a44fE9990a5E36B4501` is **live with seeded demo data**
(as of 2026-11-15; bounties expire ~2026-11-22):

- **Open bounties — left open for the live/manual demo:**
  - `#4` — AirPods Pro 2, reference **$249.00**, **20%** share, 0.1 MON escrow — *headline demo bounty*
  - `#5` — AirPods Pro 2, reference **$279.00**, **25%** share, 0.1 MON escrow
- **Filled Deal Proofs (NFTs `#0`–`#3`)** — already minted by a hunter-bot test run (all found at
  DealDepot `$189`). They populate the **Deal Proofs** gallery + leaderboard so the demo isn't empty.

### Run the manual demo
1. `cd web && npm run dev`, open http://localhost:3000 (make sure the hunter bot is **not** running).
2. **Buy** tab → bounty `#4` → **Quote** on **DealDepot** ($189) → verifies at `−24% vs MSRP` →
   **Submit deal** (connect a wallet holding testnet MON) → NFT mints; finder earns ~20% of the $60 saved.
3. **Deal Proofs** tab shows the new NFT and the updated leaderboard.

### Run the hunter bot (auto-fills open bounties)
```bash
cd web
# set HUNTER_PRIVATE_KEY (a SEPARATE, funded wallet) in .env.local
npm run hunter   # polls /api/bounties, quotes demo stores, submits the best deal that beats the reference
```
The bot signs `submitDeal` with `HUNTER_PRIVATE_KEY` — keep it distinct from the poster wallet and
funded with a little MON for gas. **Stop it (Ctrl-C) before a manual demo** so bounties stay open.

> Demo keys (oracle + hunter) live only in `web/.env.local` (gitignored). Never commit them.

## Build & test (contracts)

```bash
forge install           # forge-std + openzeppelin-contracts
forge test -vv          # 8 tests: valid deal, bad sig, price>=ref, refund-after-expiry, + extras
```

## Deploy (contracts)

```bash
cp .env.example .env    # set ORACLE_ADDRESS, PRIVATE_KEY, MONAD_RPC_URL  (.env is gitignored)
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
```

## Deploy on Vercel

1. Import the repo.
2. Set **Root Directory** to `web`.
3. Add env vars: `ORACLE_PRIVATE_KEY`, `ORACLE_ADDRESS`, `CONTRACT_ADDRESS`, `CHAIN_ID`, `ALLOWED_HOSTS` (include your production host).
4. Deploy. Vercel’s own deployment URLs are allowlisted automatically for quoting mock stores.

## Repo layout

```
src/DealBounty.sol        the contract
test/DealBounty.t.sol     Foundry tests
script/Deploy.s.sol       deploy script
abi/DealBounty.abi.json   ABI for the frontend/oracle
DYLAN_HANDOFF.md          signing recipe + integration notes
web/                      Next.js 16 marketplace + oracle
```
