# MonadFLIP

Oracle-backed deal bounty app for Monad testnet. The Next.js app in `web/` scrapes mock storefront prices, signs quotes with an oracle key, and exposes them for on-chain verification.

## Quick start

```bash
cd web
cp .env.example .env.local   # fill ORACLE_PRIVATE_KEY + ORACLE_ADDRESS
npm ci
npm run dev
```

Generate a throwaway oracle key:

```bash
node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts'); const pk=generatePrivateKey(); console.log(pk, privateKeyToAccount(pk).address)"
```

## Environment variables

| Variable | Purpose |
|---|---|
| `ORACLE_PRIVATE_KEY` | Hex private key used to sign quotes |
| `ORACLE_ADDRESS` | Address of that key (checked by `npm run verify`) |
| `CONTRACT_ADDRESS` | MonadFLIP bounty contract (`address(this)` in the hash); `0x0…0` until deploy |
| `CHAIN_ID` | `10143` (Monad testnet) |
| `ALLOWED_HOSTS` | Comma-separated hosts `/api/quote` may fetch (Vercel deployment URLs are added automatically) |

Never commit `.env.local`.

## API

### `GET /api/oracle`

Returns oracle config (no secrets).

```json
{
  "oracle": "0x…",
  "chainId": 10143,
  "contract": "0x0000000000000000000000000000000000000000",
  "contractIsPlaceholder": true,
  "allowedHosts": ["localhost", "127.0.0.1"]
}
```

### `POST /api/quote`

Request:

```json
{
  "bountyId": "42",
  "url": "http://localhost:3000/stores/dealdepot"
}
```

Response:

```json
{
  "bountyId": "42",
  "url": "http://localhost:3000/stores/dealdepot",
  "priceCents": 18900,
  "sig": "0x…",
  "oracle": "0x…",
  "hash": "0x…",
  "chainId": 10143,
  "contract": "0x0000000000000000000000000000000000000000",
  "priceSource": "json-ld"
}
```

Demo store prices (cents): VoltMart `22900`, Redline Goods `20900`, DealDepot `18900`.

**Blake / frontend:** the oracle signs the exact `url` string. Submit `url` from `/api/quote` unchanged on-chain or the signature check fails.

## Verify locally

With `npm run dev` running:

```bash
cd web
npm run verify
# optional: npm run verify -- voltmart
```

Expect `PASS`.

## Solidity verification

The contract must recover the same oracle address:

```solidity
bytes32 hash = keccak256(
  abi.encodePacked(
    uint256(bountyId),
    string(url),       // exact string signed by /api/quote
    uint256(priceCents),
    block.chainid,
    address(this)
  )
);
bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(hash);
address signer = ECDSA.recover(ethHash, sig);
require(signer == oracle, "bad oracle sig");
```

`url` must be the exact signed string (same bytes as in the quote response).

## Deploy on Vercel

1. Import the repo.
2. Set **Root Directory** to `web`.
3. Add env vars: `ORACLE_PRIVATE_KEY`, `ORACLE_ADDRESS`, `CONTRACT_ADDRESS`, `CHAIN_ID`, `ALLOWED_HOSTS` (include your production host).
4. Deploy. Vercel’s own deployment URLs are allowlisted automatically for quoting mock stores.
