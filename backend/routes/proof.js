/**
 * POST /proof/generate  — generate Merkle proof for selective disclosure
 * POST /proof/verify    — verify Merkle proof + ECC signature + revocation status
 */

const express = require('express');
const router = express.Router();
const { generateProof, verifyProof } = require('../merkle/merkleService');
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
    if (!credentialId || !proof || !leaf) {
      return res.status(400).json({ error: 'credentialId, proof, leaf required' });
    }

    // 1. Check on-chain: not revoked + issuer authorized
    const cred = getCredential(credentialId);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    const [onChainRevoked, issuerAuthorized] = await Promise.all([
      blockchain.isCredentialRevoked(credentialId).catch(() => null),
      blockchain.isIssuerAuthorized(cred.issuerAddress).catch(() => false),
    ]);

    // Treat as revoked if flagged either on-chain OR in local DB
    const effectivelyRevoked = onChainRevoked === true || cred.revoked === true;
    if (effectivelyRevoked) {
      return res.json({ valid: false, reason: 'Credential has been revoked' });
    }
    if (!issuerAuthorized) {
      return res.json({ valid: false, reason: 'Issuer is not authorized on-chain' });
    }

    const merkleRoot = cred.merkleRoot;

    // 2. Verify Merkle proof against stored root
    const merkleOk = verifyProof(proof, leaf, merkleRoot);
    if (!merkleOk) {
      return res.json({ valid: false, reason: 'Merkle proof invalid' });
    }

    // 3. Verify ECC signature using exact payload that was signed at issuance
    let eccSignatureValid = false;
    {
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
