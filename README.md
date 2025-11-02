# FHE AMM — Privacy-preserving AMM parameter optimizer (Zama FHEVM)

This project implements a full DApp (backend + frontend) that follows Zama's official template patterns for using FHEVM:
- Smart contracts operate on encrypted data using `@fhevm/solidity` types and helpers
- Frontend performs client-side decryption via Zama Relayer SDK EIP-712 signature flow
- Encryption: `instance.createEncryptedInput(…)` + `input.encrypt()` → pass `handles` + `inputProof` to contract
- Decryption: `FhevmDecryptionSignature.loadOrSign(…)` → `instance.userDecrypt(…)`

The solution is split into two packages under `./fheAMM`:
- `./backend`: Hardhat + hardhat-deploy, 1 contract `FHEAMM.sol` with all features
- `./frontend`: Next.js app with hooks and helpers mirroring the official template

## Features
- Encrypted position submission: enc(liquidity), enc(price_lower), enc(price_upper)
- Encrypted aggregates: Σ enc(liquidity), Σ enc(price_lower), Σ enc(price_upper), 2×enc(numPositions)
- Encrypted suggestions: feeRatio, tickSpacing updated based on enc(volatility) vs threshold
- Client-side decryption for verification
- Governance: `applyParameters(feeRatio, tickSpacing)` owner-only in clear
- On-chain audit trail: emits and stores operation hashes without leaking values

## Requirements
- Node.js >= 20
- npm >= 7
- MetaMask
- For local dev with full FHEVM features in the browser: run a Zama FHEVM Hardhat Node (the frontend auto-detects it and uses `@fhevm/mock-utils`). Alternatively, use Sepolia with Zama Relayer SDK.

## Dependencies (pinned per requirement)
- Backend:
  - `@fhevm/solidity`: ^0.8.0
  - `@fhevm/hardhat-plugin`: ^0.1.0
  - `hardhat-deploy`: ^0.12.4
- Frontend:
  - `@fhevm/mock-utils`: 0.1.0
  - `@zama-fhe/relayer-sdk`: ^0.2.0 (types + CDN runtime)

## 1) Backend — Hardhat

Location: `./backend`

Install deps:
```bash
cd fheAMM/backend
npm install
```

Compile:
```bash
npm run compile
```

Deploy (localhost):
```bash
npx hardhat deploy --network localhost
```

Deploy (Sepolia):
```bash
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY
npx hardhat deploy --network sepolia
```

Notes:
- The contract `FHEAMM.sol` uses `FHE`, `euint32` and `externalEuint32` types and mirrors Zama's template patterns (`FHE.fromExternal`, `FHE.add/sub`, `FHE.ge`, `FHE.select`, `FHE.allowThis`, `FHE.allow`).
- `submitPosition(...)` accepts 3 encrypted inputs and a single `inputProof` produced client-side from `createEncryptedInput()`.

## 2) Frontend — Next.js

Location: `./frontend`

Install deps:
```bash
cd fheAMM/frontend
npm install
```

Generate ABI + addresses (reads `../backend/deployments`):
```bash
npm run genabi
```

Run dev:
```bash
npm run dev
```

Open `http://localhost:3000`.

### Local Hardhat Node vs Sepolia
- Local: If chainId = 31337 and the RPC is a FHEVM Hardhat Node, the app dynamically loads `@fhevm/mock-utils` and runs with the mock instance for full client-side encryption/decryption.
- Sepolia: The app loads Zama Relayer SDK via CDN and creates a real FHEVM instance bound to Sepolia.

## App Walkthrough
1. Connect MetaMask
2. Submit position: enter liquidity, price lower/upper → encrypted in browser → `submitPosition(handles..., inputProof)`
3. Submit volatility: enter volatility → encrypted in browser → `submitVolatility(handle, inputProof)`
4. Refresh aggregates → decrypt → verify suggested feeRatio/tickSpacing along with aggregates
5. Owner applies clear parameters with `applyParameters(feeRatio, tickSpacing)`

## File Map (key files)
- Backend
  - `contracts/FHEAMM.sol` — single contract with all logic
  - `deploy/deploy.ts` — hardhat-deploy script
  - `hardhat.config.ts` — plugin + compiler settings (EVM cancun)
- Frontend
  - `fhevm/` — copied from the template: `useFhevm`, `FhevmDecryptionSignature`, internal loader and storage
  - `hooks/useFHEAMM.tsx` — contract integration, encryption, decryption, governance actions
  - `scripts/genabi.mjs` — generates `abi/FHEAMMABI.ts` and `abi/FHEAMMAddresses.ts` from backend deployments
  - `app/page.tsx` — simple UI wiring all actions

## Security Notes
- All sensitive fields are stored and computed as ciphertext on-chain.
- Decryption is client-side and requires per-user EIP-712 signature flow identical to Zama's template.
- Aggregates expose only handles; anyone needs access to ciphertext + permission to decrypt.

## Troubleshooting
- Frontend can’t find address: run backend deployment, then `npm run genabi` in `frontend`.
- Local decrypt fails: ensure you are on a FHEVM Hardhat Node (not plain Hardhat). The app will try to detect and switch to mock mode automatically.
- Abi mismatch across networks: re-deploy to localhost and Sepolia to align ABIs.

## License
MIT
