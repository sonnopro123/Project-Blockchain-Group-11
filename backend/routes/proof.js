/**
 * POST /proof/generate  — generate Merkle proof for selective disclosure
 * POST /proof/verify    — verify Merkle proof + ECC signature + revocation status
 */

const express = require('express');
const router = express.Router();
const { generateProof, verifyProof, hashLeafHex } = require('../merkle/merkleService');
const { verifySignature } = require('../services/eccService');
const { getCredential, getIssuer } = require('../storage/db');
const blockchain = require('../blockchain/blockchainService');

// POST /proof/generate
router.post('/generate', async (req, res) => {
  try {
    const { credentialId, courseCode } = req.body;
    if (!credentialId || !courseCode) {
      return res.status(400).json({ error: 'credentialId and courseCode required' });
    }

    const cred = getCredential(credentialId);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    const targetCourse = cred.courses.find((c) => c.courseCode === courseCode);
    if (!targetCourse) {
      return res.status(404).json({ error: `Course "${courseCode}" not in credential` });
    }

    const proofData = generateProof(cred.courses, targetCourse);

    return res.json({ credentialId, ...proofData });
  } catch (err) {
    console.error('[/proof/generate]', err);
    return res.status(500).json({ error: 'Failed to generate proof' });
  }
});

// POST /proof/verify
router.post('/verify', async (req, res) => {
  try {
    const { credentialId, proof, leaf, courseCode, grade } = req.body;

    if (!credentialId || !proof || !leaf || !courseCode || !grade) {
      return res.status(400).json({ error: 'credentialId, proof, leaf, courseCode, grade are all required' });
    }

    // Guard: recompute expected leaf from claimed courseCode + grade.
    // Rejects a proof where the client sends a valid leaf/proof for one course
    // but claims it belongs to a different course/grade.
    const expectedLeaf = hashLeafHex({ courseCode, grade });
    if (expectedLeaf.toLowerCase() !== leaf.toLowerCase()) {
      return res.json({
        valid: false,
        reason: 'Leaf does not match courseCode|grade — tampered disclosure rejected',
      });
    }

    // 1. Fetch credential from DB
    const cred = getCredential(credentialId);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    // 2. Check revocation: on-chain takes precedence; fall back to local DB flag
    const [onChainRevoked, issuerAuthorized] = await Promise.all([
      blockchain.isCredentialRevoked(credentialId).catch(() => null),
      blockchain.isIssuerAuthorized(cred.issuerAddress).catch(() => false),
    ]);

    const effectivelyRevoked = onChainRevoked === true || cred.revoked === true;
    if (effectivelyRevoked) {
      return res.json({ valid: false, reason: 'Credential has been revoked' });
    }
    if (!issuerAuthorized) {
      return res.json({ valid: false, reason: 'Issuer is not authorized on-chain' });
    }

    // 3. Verify Merkle proof against stored root
    const merkleOk = verifyProof(proof, leaf, cred.merkleRoot);
    if (!merkleOk) {
      return res.json({ valid: false, reason: 'Merkle proof invalid' });
    }

    // 4. Verify ECC signature using the exact payload signed at issuance
    let eccSignatureValid = false;
    const issuer = getIssuer(cred.issuerAddress);
    if (issuer) {
      const payload = {
        issuerAddress: cred.issuerAddress,
        studentId: cred.studentId,
        studentName: cred.studentName,
        courses: cred.courses,
        issuedAt: cred.issuedAt,
      };
      eccSignatureValid = verifySignature(payload, cred.signature, issuer.publicKey);
    }

    return res.json({
      valid: merkleOk && eccSignatureValid,
      merkleProofValid: merkleOk,
      eccSignatureValid,
      courseCode,
      grade,
    });
  } catch (err) {
    console.error('[/proof/verify]', err);
    return res.status(500).json({ error: 'Failed to verify proof' });
  }
});

module.exports = router;
