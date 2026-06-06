/**
 * Simple JSON-file local storage for credentials and issuers.
 * Acts as an off-chain cache / source of truth for backend data.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

function _load() {
  if (!fs.existsSync(DB_PATH)) {
    return { issuers: {}, credentials: {} };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function _save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Issuer operations
// ---------------------------------------------------------------------------

/**
 * @param {string} address
 * @param {{ name: string, publicKey: string, eccPrivateKey: string, ethAddress: string }} info
 */
function saveIssuer(address, { name, publicKey, eccPrivateKey, ethAddress }) {
  const db = _load();
  db.issuers[address] = {
    address,
    name,
    publicKey,
    eccPrivateKey,   // ECC key — used to sign credentials off-chain
    ethAddress,
    // No Ethereum private key stored — on-chain actions use MetaMask in the UI
    registeredAt: new Date().toISOString(),
  };
  _save(db);
}

function getIssuer(address) {
  return _load().issuers[address] || null;
}

function getAllIssuers() {
  return Object.values(_load().issuers);
}

// ---------------------------------------------------------------------------
// Credential operations
// ---------------------------------------------------------------------------

/**
 * @param {string} credentialId
 * @param {Object} data
 */
function saveCredential(credentialId, data) {
  const db = _load();
  db.credentials[credentialId] = {
    credentialId,
    credentialHash: data.credentialHash || null,
    issuerWallet: data.issuerWallet || null,
    issuerAddress: data.issuerWallet || data.issuerAddress || null,  // backward compat alias
    studentWallet: data.studentWallet || null,
    studentId: data.studentId,
    studentName: data.studentName || '',
    universityName: data.universityName || '',
    courses: data.courses,
    merkleRoot: data.merkleRoot,
    issuerSignature: data.issuerSignature || null,  // MetaMask 65-byte hex
    signature: data.signature || null,              // legacy field (unused in new flow)
    issuedAt: data.issuedAt,
    chainId: data.chainId || 0,
    contractAddress: data.contractAddress || '',
    revoked: false,
    savedAt: new Date().toISOString(),
  };
  _save(db);
}

function getCredential(credentialId) {
  return _load().credentials[credentialId] || null;
}

function markRevoked(credentialId) {
  const db = _load();
  if (db.credentials[credentialId]) {
    db.credentials[credentialId].revoked = true;
    db.credentials[credentialId].revokedAt = new Date().toISOString();
    _save(db);
  }
}

/**
 * Returns the first non-revoked credential for this student+issuer pair, or null.
 * Used to block re-issuing while an active credential exists.
 */
function getActiveCredentialForStudent(studentId, issuerAddress) {
  const db = _load();
  return Object.values(db.credentials).find(
    (c) => c.studentId === studentId &&
           (c.issuerWallet === issuerAddress || c.issuerAddress === issuerAddress) &&
           !c.revoked
  ) || null;
}

module.exports = { saveIssuer, getIssuer, getAllIssuers, saveCredential, getCredential, markRevoked, getActiveCredentialForStudent };
