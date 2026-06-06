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

    if (!issuerAddress || !studentId || !courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        error: 'issuerAddress, studentId, and a non-empty courses array are required',
      });
    }

    if (courses.length > 100) {
      return res.status(400).json({ error: 'Too many courses (max 100)' });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(issuerAddress)) {
      return res.status(400).json({ error: 'Invalid issuerAddress format' });
    }

    const issuerRecord = getIssuer(issuerAddress);
    if (!issuerRecord) {
      return res.status(404).json({ error: 'Issuer not found. Register issuer first.' });
    }

    const eccPrivateKey = issuerRecord.eccPrivateKey;
    if (!eccPrivateKey) {
      return res.status(500).json({ error: 'Issuer ECC key not found in storage. Re-register issuer.' });
    }

    const activeCredential = getActiveCredentialForStudent(studentId, issuerAddress);
    if (activeCredential) {
      return res.status(409).json({
        error: 'Student already has an active credential from this issuer. Revoke the existing credential before issuing a new one.',
        existingCredentialId: activeCredential.credentialId,
      });
    }

    const issuedAt = new Date().toISOString();
    const payload = { issuerAddress, studentId, studentName, courses, issuedAt };

    const { signature, hash } = signCredential(payload, eccPrivateKey);
    const merkleRoot = generateRoot(courses);

    const credentialId = ethers.keccak256(
      ethers.toUtf8Bytes(`${studentId}:${issuerAddress}:${issuedAt}`)
    );

    saveCredential(credentialId, {
      issuerAddress,
      studentId,
      studentName,
      courses,
      merkleRoot,
      signature,
      payloadHash: hash,
      issuedAt,
    });

    return res.status(201).json({
      credentialId,
      merkleRoot,
      signature,
      payload,
    });
  } catch (err) {
    console.error('[/credential/issue]', err);
    return res.status(500).json({ error: 'Failed to issue credential' });
  }
});

// POST /credential/revoke
// Marks credential as revoked off-chain.
// On-chain revocation must be performed by the issuer via MetaMask in the web UI
// (contract function revokeCredential is onlyAuthorizedIssuer — only issuer's wallet can sign).
router.post('/revoke', async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) return res.status(400).json({ error: 'credentialId required' });

    const cred = getCredential(credentialId);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });
    if (cred.revoked) return res.status(409).json({ error: 'Already revoked' });

    markRevoked(credentialId);

    return res.json({
      message: 'Credential revoked off-chain. Complete on-chain revocation via MetaMask in the Issuer Dashboard.',
      credentialId,
    });
  } catch (err) {
    console.error('[/credential/revoke]', err);
    return res.status(500).json({ error: 'Failed to revoke credential' });
  }
});

// GET /credential/:id
router.get('/:id', async (req, res) => {
  try {
    const cred = getCredential(req.params.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    const onChainRevoked = await blockchain.isCredentialRevoked(req.params.id).catch(() => null);
    return res.json({ ...cred, onChainRevoked: onChainRevoked ?? cred.revoked });
  } catch (err) {
    console.error('[/credential/:id]', err);
    return res.status(500).json({ error: 'Failed to fetch credential' });
  }
});

module.exports = router;
