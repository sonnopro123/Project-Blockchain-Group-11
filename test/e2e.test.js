/**
 * END-TO-END TEST — Phase 6
 * Tests full flow qua HTTP endpoints (server phải đang chạy trên port 3000).
 *
 * Flow:
 *   1. Register issuer
 *   2. Issue credential
 *   3. Generate proof (selective disclosure)
 *   4. Verify proof → expect valid: true
 *   5. Revoke credential
 *   6. Verify proof lại → expect valid: false
 *
 * Chạy: node test/e2e.test.js
 *
 * Yêu cầu trước khi chạy:
 *   - npx hardhat node        (terminal 1)
 *   - npx hardhat run scripts/deploy.js --network localhost  (terminal 2, cập nhật .env)
 *   - node backend/server.js  (terminal 3)
 *
 * Hardhat test accounts (pre-funded):
 *   Account #0 (owner, dùng cho OWNER_PRIVATE_KEY trong .env):
 *     Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *     Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *
 *   Account #1 (issuer):
 *     Address:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *     Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
 */

const BASE_URL = 'http://localhost:3000';

// Hardhat Account #1 — used as issuer
const ISSUER_ETH_ADDRESS  = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ISSUER_ETH_PRIVKEY  = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

let credentialId;    // returned from /credential/issue
let proofData;       // returned from /proof/generate

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, body: await res.json() };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${message}`);
}

// ---------------------------------------------------------------------------
// Test steps
// ---------------------------------------------------------------------------

async function step1_registerIssuer() {
  console.log('\n--- STEP 1: Register Issuer ---');
  const { status, body } = await post('/issuer/register', {
    name: 'Hanoi University of Science and Technology',
    ethAddress: ISSUER_ETH_ADDRESS,
    ethPrivateKey: ISSUER_ETH_PRIVKEY,
  });

  assert(status === 201 || status === 409, `HTTP status should be 201 or 409, got ${status}`);
  if (status === 201) {
    assert(!!body.issuer.eccPublicKey, 'eccPublicKey should be returned');
    console.log('  Issuer registered. eccPublicKey:', body.issuer.eccPublicKey.slice(0, 20) + '...');
  } else {
    console.log('  Issuer already registered — continuing (eccPrivateKey stored in backend DB)');
  }
}

async function step2_issueCredential() {
  console.log('\n--- STEP 2: Issue Credential ---');
  const { status, body } = await post('/credential/issue', {
    issuerAddress: ISSUER_ETH_ADDRESS,
    studentId: 'SV-2021-001',
    studentName: 'Nguyen Van A',
    courses: [
      { courseCode: 'IT4527E', grade: 'A' },
      { courseCode: 'IT3040',  grade: 'B+' },
      { courseCode: 'MI1110',  grade: 'A-' },
      { courseCode: 'PH1110',  grade: 'B' },
    ],
  });

  assert(status === 201, `HTTP status should be 201, got ${status}: ${JSON.stringify(body)}`);
  credentialId = body.credentialId;
  assert(!!credentialId, 'credentialId should be returned');
  assert(!!body.merkleRoot, 'merkleRoot should be returned');
  assert(!!body.signature?.r, 'ECC signature r should exist');
  assert(!!body.signature?.s, 'ECC signature s should exist');
  console.log('  credentialId:', credentialId);
  console.log('  merkleRoot:  ', body.merkleRoot);
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
    proof: proofData.proof,
    leaf: proofData.leaf,
    courseCode: proofData.courseCode,
    grade: proofData.grade,
  });

  assert(status === 200, `HTTP status should be 200, got ${status}`);
  assert(body.valid === true,            'valid should be true');
  assert(body.merkleProofValid === true,  'merkleProofValid should be true');
  assert(body.eccSignatureValid === true, 'eccSignatureValid should be true');
  console.log('  Result:', JSON.stringify(body));
}

async function step5_revokeCredential() {
  console.log('\n--- STEP 5: Revoke Credential ---');
  const { status, body } = await post('/credential/revoke', { credentialId });

  assert(status === 200, `HTTP status should be 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.message === 'Credential revoked', 'revoke message should match');
  console.log('  Credential revoked successfully');
}

async function step6_verifyProof_shouldFail() {
  console.log('\n--- STEP 6: Verify Proof After Revocation → expect INVALID ---');
  const { status, body } = await post('/proof/verify', {
    credentialId,
    proof: proofData.proof,
    leaf: proofData.leaf,
    courseCode: proofData.courseCode,
    grade: proofData.grade,
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
  console.log('  E2E TEST — Academic Credential System');
  console.log('========================================');

  // Health check first
  const health = await get('/health');
  assert(health.status === 200, 'Server should be running');

  await step1_registerIssuer();
  await step2_issueCredential();
  await step3_generateProof();
  await step4_verifyProof_shouldPass();
  await step5_revokeCredential();
  await step6_verifyProof_shouldFail();

  console.log('\n========================================');
  console.log('  ALL E2E TESTS PASSED');
  console.log('========================================\n');
}

run().catch((err) => {
  console.error('\n[ERROR]', err.message);
  process.exit(1);
});
