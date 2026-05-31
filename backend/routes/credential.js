/**
 * POST /credential/issue
 * POST /credential/revoke
 * GET  /credential/:id
 */

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { signCredential } = require('../services/eccService');
const { generateRoot } = require('../merkle/merkleService');
const { saveCredential, getCredential, markRevoked, getIssuer, getActiveCredentialForStudent } = require('../storage/db');
const blockchain = require('../blockchain/blockchainService');

// POST /credential/issue
router.post('/issue', async (req, res) => {
  try {
    const { issuerAddress, studentId, studentName, courses } = req.body;

    if (!issuerAddress || !studentId || !courses || courses.length === 0) {
      return res.status(400).json({
        error: 'issuerAddress, studentId, courses required',
      });
    }

    // Verify issuer exists in db (must have been registered first)
    const issuerRecord = getIssuer(issuerAddress);
    if (!issuerRecord) {
      return res.status(404).json({ error: 'Issuer not found. Register issuer first.' });
    }

    // Retrieve ECC private key from DB — clients no longer need to send it
    const eccPrivateKey = issuerRecord.eccPrivateKey;
    if (!eccPrivateKey) {
      return res.status(500).json({ error: 'Issuer ECC key not found in storage. Re-register issuer.' });
    }

    // Block if student already has an active (non-revoked) credential from this issuer
    const activeCredential = getActiveCredentialForStudent(studentId, issuerAddress);
    if (activeCredential) {
      return res.status(409).json({
        error: 'Student already has an active credential from this issuer. Revoke the existing credential before issuing a new one.',
        existingCredentialId: activeCredential.credentialId,
      });
    }

    // 1. Build payload — issuedAt fixed here and stored for later signature verification
    const issuedAt = new Date().toISOString();
    const payload = { issuerAddress, studentId, studentName, courses, issuedAt };

    // 2. ECC sign with issuer's ECC private key
    const { signature, hash } = signCredential(payload, eccPrivateKey);

    // 3. Build Merkle root from courses
    const merkleRoot = generateRoot(courses);

    // 4. Derive credential ID = keccak256(studentId:issuerAddress:issuedAt)
    //    Including issuedAt ensures each issuance has a unique on-chain credentialId,
    //    allowing re-issue after the previous credential has been revoked.
    const credentialId = ethers.keccak256(
      ethers.toUtf8Bytes(`${studentId}:${issuerAddress}:${issuedAt}`)
    );

    // 5. Issue on-chain — signed by issuer's Ethereum wallet (onlyAuthorizedIssuer)
    await blockchain.issueCredentialOnChain(credentialId, merkleRoot, issuerRecord.ethPrivateKey);

    // 6. Save off-chain — store issuedAt so proof/verify can reconstruct exact payload
    saveCredential(credentialId, {
      issuerAddress,
      studentId,
      studentName,
      courses,
      merkleRoot,
      signature,
      payloadHash: hash,
      issuedAt,        // ← critical: must match what was signed
    });

    return res.status(201).json({
      credentialId,
      merkleRoot,
      signature,
      payload,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /credential/revoke
router.post('/revoke', async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) return res.status(400).json({ error: 'credentialId required' });

    const cred = getCredential(credentialId);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });
    if (cred.revoked) return res.status(409).json({ error: 'Already revoked' });

    const issuerRecord = getIssuer(cred.issuerAddress);
    if (!issuerRecord) return res.status(404).json({ error: 'Issuer record not found' });

    // Revoke on-chain signed by the issuer's Ethereum wallet
    await blockchain.revokeCredentialOnChain(credentialId, issuerRecord.ethPrivateKey);
    markRevoked(credentialId);

    return res.json({ message: 'Credential revoked', credentialId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /credential/:id
router.get('/:id', async (req, res) => {
  try {
    const cred = getCredential(req.params.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    const onChain = await blockchain.verifyCredentialOnChain(req.params.id);
    return res.json({ ...cred, onChainValid: onChain.valid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
