/**
 * END-TO-END TEST — Unified MetaMask/On-chain Flow
 *
 * Tests the full credential lifecycle using ethers.Wallet to simulate MetaMask signing.
 *
 * Flow:
 *   1. resetDB() — clear old data.json
 *   2. Register issuer (POST /issuer/register)
 *   3. Build credential + compute credentialHash (same algorithm as frontend)
 *   4. Sign credentialHash with ethers.Wallet (simulating MetaMask EIP-191)
 *   5. Cache credential via POST /credential/issue (new format)
 *   6. Generate proof via POST /proof/generate
 *   7. Verify proof — expect valid: true
 *   7b. Tampered grade — expect valid: false (leaf mismatch)
 *   8. Issue on-chain: contract.issueCredential(credentialHash)
 *   9. Revoke on-chain: contract.revokeCredential(credentialHash)
 *   10. Verify proof again — expect valid: false (on-chain revoked)
 *
 * Run: node test/e2e.test.js
 *
 * Prerequisites:
 *   - npx hardhat node                                               (terminal 1)
 *   - npx hardhat run scripts/deploy.js --network localhost          (terminal 2)
 *   - node backend/server.js                                         (terminal 3)
 *
 * Hardhat test accounts (pre-funded):
 *   Account #0 (owner — OWNER_PRIVATE_KEY in .env):
 *     Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *     Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *
 *   Account #1 (issuer):
 *     Address:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *     Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { generateRoot } = require('../backend/merkle/merkleService');
const artifact = require('../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json');

const BASE_URL = 'http://localhost:3000';
const API_KEY  = process.env.API_KEY || '';

// Hardhat Account #0 (owner)
const OWNER_ETH_PRIVKEY  = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Hardhat Account #1 (issuer)
const ISSUER_ETH_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ISSUER_ETH_PRIVKEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

// Student wallet (Account #2 for test)
const STUDENT_WALLET     = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

const STUDENT_ID   = `SV-${Date.now()}`;
const STUDENT_NAME = 'Nguyen Van A';
const COURSES = [
  { courseCode: 'IT4527E', grade: 'A' },
  { courseCode: 'IT3040',  grade: 'B+' },
  { courseCode: 'MI1110',  grade: 'A-' },
  { courseCode: 'PH1110',  grade: 'B' },
];

let credentialId;
let credentialHash;
let issuerSignature;
let proofData;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetDB() {
  const dbPath = path.join(__dirname, '..', 'backend', 'storage', 'data.json');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('  [SETUP] Cleared old data.json — starting fresh.');
  }
}

async function post(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function get(url) {
  const res = await fetch(`${BASE_URL}${url}`);
  return { status: res.status, body: await res.json() };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${message}`);
}

/** Compute credentialId — mirrors frontend/src/services/credential.js */
function computeCredentialId(studentWallet, issuerWallet, issuedAt) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(
      `${studentWallet.toLowerCase()}:${issuerWallet.toLowerCase()}:${issuedAt}`
    )
  );
}

/** Compute credentialHash — mirrors frontend/src/services/credential.js */
function computeCredentialHash(cred) {
  const parts = [
    cred.credentialId,
    cred.merkleRoot,
    cred.issuerWallet.toLowerCase(),
    cred.studentWallet.toLowerCase(),
    cred.issuedAt,
    String(cred.chainId),
    cred.contractAddress.toLowerCase(),
  ].join('|');
  return ethers.keccak256(ethers.toUtf8Bytes(parts));
}

// ---------------------------------------------------------------------------
// Test steps
// ---------------------------------------------------------------------------

async function step1_registerIssuer() {
  console.log('\n--- STEP 1: Register Issuer ---');
  const { status, body } = await post('/issuer/register', {
    name: 'Hanoi University of Science and Technology',
    ethAddress: ISSUER_ETH_ADDRESS,
    // No ethPrivateKey — backend no longer accepts or stores ETH private keys
  });

  assert(status === 201 || status === 409, `HTTP status should be 201 or 409, got ${status}: ${JSON.stringify(body)}`);
  if (status === 201) {
    assert(!!body.issuer.eccPublicKey, 'eccPublicKey should be returned');
    console.log('  Issuer registered. eccPublicKey:', body.issuer.eccPublicKey.slice(0, 20) + '...');
  } else {
    console.log('  Issuer already registered — continuing.');
  }
}

async function step2_buildAndSignCredential() {
  console.log('\n--- STEP 2: Build credential + sign with ethers.Wallet (simulate MetaMask) ---');

  const issuedAt = new Date().toISOString();
  const contractAddress = process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const chainId = 31337; // Hardhat local chain

  credentialId = computeCredentialId(STUDENT_WALLET, ISSUER_ETH_ADDRESS, issuedAt);
  const merkleRoot = generateRoot(COURSES);

  const base = {
    credentialId,
    merkleRoot,
    issuerWallet: ISSUER_ETH_ADDRESS,
    studentWallet: STUDENT_WALLET,
    issuedAt,
    chainId,
    contractAddress,
  };

  credentialHash = computeCredentialHash(base);

  // Simulate MetaMask EIP-191 signing
  const issuerWallet = new ethers.Wallet(ISSUER_ETH_PRIVKEY);
  issuerSignature = await issuerWallet.signMessage(ethers.getBytes(credentialHash));

  console.log('  credentialId:   ', credentialId);
  console.log('  credentialHash: ', credentialHash);
  console.log('  merkleRoot:     ', merkleRoot);
  console.log('  issuerSignature:', issuerSignature.slice(0, 20) + '...');

  // Cache credential via POST /credential/issue
  console.log('\n--- STEP 2b: Cache credential via POST /credential/issue ---');
  const { status, body } = await post('/credential/issue', {
    credentialId,
    credentialHash,
    issuerWallet: ISSUER_ETH_ADDRESS,
    issuerSignature,
    studentWallet: STUDENT_WALLET,
    studentId: STUDENT_ID,
    studentName: STUDENT_NAME,
    universityName: 'Hanoi University of Science and Technology',
    courses: COURSES,
    merkleRoot,
    issuedAt,
    chainId,
    contractAddress,
  });

  assert(status === 201, `HTTP status should be 201, got ${status}: ${JSON.stringify(body)}`);
  assert(body.credentialId === credentialId, 'Returned credentialId should match');
  assert(body.credentialHash === credentialHash, 'Returned credentialHash should match');
  console.log('  Credential cached successfully.');
}

async function step3_generateProof() {
  console.log('\n--- STEP 3: Generate Selective Proof (IT4527E only) ---');
  const { status, body } = await post('/proof/generate', {
    credentialId,
    courseCode: 'IT4527E',
  });

  assert(status === 200, `HTTP status should be 200, got ${status}: ${JSON.stringify(body)}`);
  assert(Array.isArray(body.proof), 'proof should be an array');
  assert(!!body.leaf, 'leaf should exist');
  assert(!!body.root, 'root should exist');
  proofData = body;
  console.log('  proof siblings:', body.proof.length, 'nodes');
  console.log('  leaf:', body.leaf);
}

async function step4_verifyProof_shouldPass() {
  console.log('\n--- STEP 4: Verify Proof → expect VALID ---');
  const { status, body } = await post('/proof/verify', {
    credentialId,
    proof:      proofData.proof,
    leaf:       proofData.leaf,
    courseCode: proofData.courseCode,
    grade:      proofData.grade,
  });

  assert(status === 200, `HTTP status should be 200, got ${status}`);
  assert(body.valid === true,            'valid should be true');
  assert(body.merkleProofValid === true,  'merkleProofValid should be true');
  assert(body.eccSignatureValid === true, 'eccSignatureValid should be true');
  console.log('  Result:', JSON.stringify(body));
}

async function step4b_verifyProof_tamperedGrade_shouldFail() {
  console.log('\n--- STEP 4b: Tampered grade → expect INVALID (leaf mismatch) ---');
  const { status, body } = await post('/proof/verify', {
    credentialId,
    proof:      proofData.proof,
    leaf:       proofData.leaf,   // real leaf for IT4527E grade A
    courseCode: proofData.courseCode,
    grade:      'A+',             // tampered grade
  });

  assert(status === 200, `HTTP status should be 200, got ${status}`);
  assert(body.valid === false, 'tampered grade should be rejected');
  console.log('  Result:', JSON.stringify(body));
}

async function step5_issueOnChain() {
  console.log('\n--- STEP 5: Issue on-chain (issuer calls issueCredential) ---');
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.log('  [SKIP] CONTRACT_ADDRESS not set in .env — skipping on-chain steps.');
    return false;
  }

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const issuerSigner = new ethers.Wallet(ISSUER_ETH_PRIVKEY, provider);
  const contract = new ethers.Contract(contractAddress, artifact.abi, issuerSigner);

  const tx = await contract.issueCredential(credentialHash);
  await tx.wait();
  console.log('  issueCredential tx mined. Hash:', tx.hash);
  return true;
}

async function step6_revokeOnChain() {
  console.log('\n--- STEP 6: Revoke on-chain (issuer calls revokeCredential) ---');
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.log('  [SKIP] CONTRACT_ADDRESS not set in .env — skipping on-chain steps.');
    return false;
  }

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const issuerSigner = new ethers.Wallet(ISSUER_ETH_PRIVKEY, provider);
  const contract = new ethers.Contract(contractAddress, artifact.abi, issuerSigner);

  const tx = await contract.revokeCredential(credentialHash);
  await tx.wait();
  console.log('  revokeCredential tx mined. Hash:', tx.hash);
  return true;
}

async function step7_verifyProof_shouldFail() {
  console.log('\n--- STEP 7: Verify Proof After On-chain Revocation → expect INVALID ---');
  const { status, body } = await post('/proof/verify', {
    credentialId,
    proof:      proofData.proof,
    leaf:       proofData.leaf,
    courseCode: proofData.courseCode,
    grade:      proofData.grade,
  });

  assert(status === 200, `HTTP status should be 200, got ${status}`);
  assert(body.valid === false, `valid should be false after revocation, got: ${body.valid}`);
  console.log('  Result:', JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  console.log('========================================');
  console.log('  E2E TEST -- Academic Credential System');
  console.log('  Unified MetaMask / On-chain Flow');
  console.log('========================================');

  // Wipe old data
  resetDB();

  const health = await get('/health');
  assert(health.status === 200, 'Server should be running');

  await step1_registerIssuer();
  await step2_buildAndSignCredential();
  await step3_generateProof();
  await step4_verifyProof_shouldPass();
  await step4b_verifyProof_tamperedGrade_shouldFail();

  const onChainAvailable = await step5_issueOnChain();
  if (onChainAvailable) {
    await step6_revokeOnChain();
    await step7_verifyProof_shouldFail();
  }

  console.log('\n========================================');
  console.log('  ALL E2E TESTS PASSED');
  console.log('========================================\n');
}

run().catch((err) => {
  console.error('\n[ERROR]', err.message);
  process.exit(1);
});
