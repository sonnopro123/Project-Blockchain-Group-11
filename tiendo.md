# Tiến độ dự án — CredProof
### Decentralized Academic Credential Verification

Cập nhật lần cuối: 2026-06-05

---

## TỔNG QUAN NHANH

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| Smart Contract | ✅ Hoàn thành | Rewritten: addIssuer/removeIssuer/revokeCredential, 20 test pass |
| ECC Engine | ✅ Hoàn thành | MetaMask EIP-191 personal sign (frontend), no backend keys |
| Merkle Engine | ✅ Hoàn thành | Frontend pure ethers.js — sortPairs=true |
| Backend API | ✅ Legacy (backend) | Không dùng cho luồng chính — MetaMask flow là frontend-only |
| Blockchain Service | ✅ Hoàn thành | Frontend services: wallet.js, contract.js |
| End-to-End Test | ✅ Contract test 20/20 | test/CredentialRegistry.test.js |
| Frontend Sprint 1 | ✅ Hoàn thành | Landing + AdminDashboard + IssuerDashboard |
| Frontend Sprint 2 | ✅ Hoàn thành | StudentDashboard + VerifierDashboard |
| Refactor MetaMask | ✅ Hoàn thành | 2026-06-05 — xem LỊCH SỬ |
| Bug Fix: CORS + eccPrivateKey | ✅ Hoàn thành | 2026-05-31 — xem LỊCH SỬ |

---

## CHI TIẾT TỪNG MODULE

### MODULE A — Smart Contract
**File:** `contracts/CredentialRegistry.sol`
**Trạng thái:** ✅ Rewritten + 20 test all pass

Đã implement (phiên bản mới — 2026-06-05):
- `addIssuer(address)` — onlyOwner
- `removeIssuer(address)` — onlyOwner
- `revokeCredential(bytes32 credentialHash)` — onlyAuthorizedIssuer
- `isAuthorizedIssuer(address)`, `isRevoked(bytes32)`, `owner()`
- Events: `IssuerAdded`, `IssuerRemoved`, `CredentialRevoked`

Test: `test/CredentialRegistry.test.js` — 20 case, all pass

---

### MODULE B — ECC Engine
**File:** `backend/services/eccService.js`
**Trạng thái:** ✅ Hoàn thành

- `generateIssuerKeyPair()` — secp256k1
- `signCredential(payload, privateKey)` — keccak256 hash + ECDSA sign
- `verifySignature(payload, signature, publicKey)` — verify + tamper detection

Test: `test/eccMerkle.test.js` — all pass

---

### MODULE C — Merkle Engine
**File:** `backend/merkle/merkleService.js`
**Trạng thái:** ✅ Hoàn thành

- `buildMerkleTree(courses)` — sortPairs=true, keccak256 leaf hash
- `generateRoot(courses)`
- `generateProof(courses, targetCourse)` — selective disclosure
- `verifyProof(proof, leaf, root)`

Test: `test/eccMerkle.test.js` — all pass

---

### MODULE D — Backend API
**File:** `backend/server.js` + `backend/routes/`
**Trạng thái:** ✅ Chạy port 3000

| Endpoint | Trạng thái |
|----------|-----------|
| POST /issuer/register | ✅ Test pass |
| POST /credential/issue | ✅ Test pass |
| POST /credential/revoke | ✅ Test pass |
| POST /proof/generate | ✅ |
| POST /proof/verify | ✅ |
| GET /credential/:id | ✅ |
| GET /health | ✅ |

**Fix quan trọng (2026-05-10):**
- `credentialId = keccak256(studentId:issuerAddress:issuedAt)` — unique mỗi lần issue
- Duplicate check chỉ block credential ACTIVE, bỏ qua revoked
- Thêm `getActiveCredentialForStudent()` vào `backend/storage/db.js`

**Fix quan trọng (2026-05-31):**
- CORS middleware (cors package) thêm vào `backend/server.js`, origin = `FRONTEND_URL` env
- `backend/storage/db.js`: `saveIssuer` nay lưu thêm `eccPrivateKey`
- `backend/routes/credential.js`: `/credential/issue` không còn yêu cầu client gửi `eccPrivateKey` — backend tự lấy từ DB
- `frontend/src/pages/IssuerDashboard.jsx`: bỏ input `eccPrivateKey` khỏi tab Phát hành
- `scripts/deploy.js`: tự động ghi `CONTRACT_ADDRESS` vào `.env` sau khi deploy
- `frontend/.env.example`: đổi `VITE_API_BASE_URL` thành `/api` (dùng Vite proxy, tránh CORS)
- `.env.example` (root): xóa CONTRACT_ADDRESS cũ, thêm `FRONTEND_URL`, thêm comment hướng dẫn
- `test/e2e.test.js`: bỏ `eccPrivateKey` khỏi step 2, e2e có thể re-run mà không cần clear data.json

---

### MODULE E — Blockchain Service
**File:** `backend/blockchain/blockchainService.js`
**Trạng thái:** ✅ Hoàn thành

- Owner wallet → `registerIssuer` (onlyOwner)
- Issuer wallet riêng → `issueCredential` / `revokeCredential`
- `_contractAs(privateKey)` — dynamic signer per issuer

---

### STORAGE
**File:** `backend/storage/db.js` + `backend/storage/data.json`
**Trạng thái:** ✅ Hoạt động

- Lưu: issuer (ECC keys + Ethereum keys), credential (issuedAt, courses, signature, merkleRoot, revoked, revokedAt)
- `data.json` không commit lên Git

---

### FRONTEND
**Thư mục:** `frontend/`
**Trạng thái:** ✅ Hoàn thành — Chạy port 5173 — Build pass (206 modules)

| Trang / Component | Trạng thái |
|-------------------|-----------|
| Landing Page | ✅ 4 role cards (Admin/Issuer/Student/Verifier) |
| Admin Dashboard | ✅ addIssuer / removeIssuer / check status |
| Issuer Dashboard (3 tab) | ✅ MetaMask connect → sign credential → revoke |
| Student Dashboard | ✅ Upload + validate (7 checks) + selective proof |
| Verifier Dashboard | ✅ Upload proof + on-chain + ECC + Merkle verify |
| services/wallet.js | ✅ connectWallet, getReadProvider |
| services/contract.js | ✅ addIssuer, removeIssuer, revokeCredential, isAuthorizedIssuer, isRevoked |
| services/merkle.js | ✅ generateRoot, generateProof, verifyProof (pure ethers.js) |
| services/credential.js | ✅ computeCredentialHash, signCredential, verifyCredentialSignature, buildProofJSON |
| config/abi.js | ✅ ABI cho CredentialRegistry contract mới |
| utils/download.js | ✅ downloadJSON helper |

Stack: React 18 + Vite 5 + TailwindCSS + ethers.js v6

---

## MÔI TRƯỜNG HIỆN TẠI

| Thành phần | Giá trị |
|-----------|---------|
| Mạng | Hardhat localhost 127.0.0.1:8545 |
| Contract address | 0x5FbDB2315678afecb367f032d93F642f64180aa3 (local, reset mỗi khi restart node) |
| Owner wallet (Account #0) | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 |
| Issuer wallet (Account #1) | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 |
| Backend port | 3000 |
| Frontend port | 5173 |

---

## VIỆC CÒN LẠI

### Ưu tiên cao (chuẩn bị demo)
1. Khởi động Hardhat node: `npx hardhat node`
2. Deploy contract: `npx hardhat run scripts/deploy.js --network localhost`
3. Copy CONTRACT_ADDRESS → `frontend/.env` (VITE_CONTRACT_ADDRESS=0x...)
4. Chạy frontend: `cd frontend && npm run dev`
5. Cấu hình MetaMask: Network localhost:8545, chainId 31337
6. Import Account #0 (owner) và Account #1 (issuer) vào MetaMask
7. Test demo flow: Admin addIssuer → Issuer sign credential → Student validate + proof → Verifier verify

### Ưu tiên thấp (demo cuối)
- [ ] Deploy contract lên Sepolia testnet
- [ ] Cập nhật .env với Sepolia RPC + contract address

---

## LỊCH SỬ CẬP NHẬT

| Ngày | Hành động |
|------|-----------|
| 2026-04-12 | Khởi tạo project, tạo toàn bộ backend modules |
| 2026-04-12 | Fix ABI import, fix issuedAt mismatch, fix issuer wallet |
| 2026-04-12 | Backend server start thành công, /issuer/register test PASS |
| 2026-04-12 | Tạo toàn bộ frontend Sprint 1 (4 trang), Vite chạy port 5173 |
| 2026-05-01 | Tạo readme.md, tiendo.md; test /credential/issue PASS |
| 2026-05-10 | Thêm IssuerContext, Toast, Tooltip, WorkflowStepper |
| 2026-05-10 | Refactor IssuerDashboard: auto-fill, inline validation, result card |
| 2026-05-10 | Thêm CourseInput autocomplete (26 môn học mẫu) |
| 2026-05-10 | Fix bug: credential re-issue sau revoke — credentialId formula + active check |
| 2026-05-10 | Rebrand toàn bộ frontend: ChứngChỉ Chain → CredProof |
| 2026-05-11 | Cập nhật readme.md (business logic rules, UX rules, security rules, demo flow 9 bước) |
| 2026-05-11 | Remove claude.md khỏi git tracking; cập nhật .gitignore |
| 2026-05-31 | Fix CORS, eccPrivateKey storage, deploy script auto-write, frontend cleanup, e2e test update |
| 2026-06-05 | Refactor toàn bộ: contract mới (addIssuer/revokeCredential), MetaMask signing, AdminDashboard, frontend services (wallet/contract/merkle/credential), build pass 206 modules |
