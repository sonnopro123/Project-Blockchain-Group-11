/**
 * MODULE B — ECC ENGINE
 * Uses the `elliptic` library (secp256k1 curve) to sign and verify credentials.
 */

const { ec: EC } = require('elliptic');
const { keccak256 } = require('js-sha3');

const ec = new EC('secp256k1');

/**
 * Generate a new ECC key pair for an issuer.
 * @returns {{ privateKey: string, publicKey: string }}
 */
function generateIssuerKeyPair() {
  const keyPair = ec.genKeyPair();
  return {
    privateKey: keyPair.getPrivate('hex'),
    publicKey: keyPair.getPublic('hex'),
  };
}

/**
 * Sign a credential payload with an issuer's private key.
 * @param {object} credentialPayload  Plain JS object representing the credential.
 * @param {string} privateKeyHex      Issuer's private key in hex.
 * @returns {{ signature: { r: string, s: string }, hash: string }}
 */
function signCredential(credentialPayload, privateKeyHex) {
  const msgHash = _hashPayload(credentialPayload);
  const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
  const sig = keyPair.sign(msgHash);
  return {
    signature: {
      r: sig.r.toString('hex'),
      s: sig.s.toString('hex'),
    },
    hash: msgHash,
  };
}

/**
 * Verify an ECC signature against a credential payload and issuer's public key.
 * @param {object} credentialPayload  The original credential payload.
 * @param {{ r: string, s: string }} signature
 * @param {string} publicKeyHex       Issuer's public key in hex.
 * @returns {boolean}
 */
function verifySignature(credentialPayload, signature, publicKeyHex) {
  try {
    const msgHash = _hashPayload(credentialPayload);
    const keyPair = ec.keyFromPublic(publicKeyHex, 'hex');
    return keyPair.verify(msgHash, signature);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Recursive deterministic serialization — sorts object keys at every nesting level
// so hash is stable regardless of the key order the caller used when constructing the object.
function _sortedStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(_sortedStringify).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + _sortedStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function _hashPayload(payload) {
  return keccak256(_sortedStringify(payload));
}

module.exports = { generateIssuerKeyPair, signCredential, verifySignature };
