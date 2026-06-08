/**
 * POST /credential/issue
 * POST /credential/revoke
 * GET  /credential/:id
 */

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { generateRoot } = require('../merkle/merkleService');
const { saveCredential, getCredential, getActiveCredentialForStudent } = require('../storage/db');
const blockchain = require('../blockchain/blockchainService');
const logger = require('../services/logger');

// POST /credential/issue
// Receives a credential JSON already signed by MetaMask from the frontend.
// Validates the EIP-191 signature, then caches the credential off-chain.
router.post('/issue', async (req, res) => {
  try {
    const {
      credentialId,
      credentialHash,
      issuerWallet,
      issuerSignature,
      studentWallet,
      studentId,
      studentName,
      universityName,
      courses,
      merkleRoot,
      issuedAt,
      chainId,
      contractAddress,
    } = req.body;

    // Required fields
    if (!credentialId || !credentialHash || !issuerWallet || !issuerSignature || !courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        error: 'credentialId, credentialHash, issuerWallet, issuerSignature, and a non-empty courses array are required',
      });
    }

    if (courses.length > 100) {
      return res.status(400).json({ error: 'Too many courses (max 100)' });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(issuerWallet)) {
      return res.status(400).json({ error: 'Invalid issuerWallet address format' });
    }

    // Check for duplicate
    if (getCredential(credentialId)) {
      return res.status(409).json({ error: 'Credential already cached', credentialId });
    }

    // Validate MetaMask EIP-191 signature
    try {
      const recovered = ethers.verifyMessage(ethers.getBytes(credentialHash), issuerSignature);
      if (recovered.toLowerCase() !== issuerWallet.toLowerCase()) {
        return res.status(400).json({ error: 'Signature does not match issuerWallet' });
      }
    } catch (sigErr) {
      return res.status(400).json({ error: 'Invalid issuerSignature: ' + sigErr.message });
    }

    // Compute merkle root if not provided
    const computedMerkleRoot = merkleRoot || generateRoot(courses);

    // Cache credential
    saveCredential(credentialId, {
      credentialHash,
      issuerWallet,
      studentWallet: studentWallet || null,
      studentId: studentId || '',
      studentName: studentName || '',
      universityName: universityName || '',
      courses,
      merkleRoot: computedMerkleRoot,
      issuerSignature,
      issuedAt: issuedAt || new Date().toISOString(),
      chainId: chainId || 0,
      contractAddress: contractAddress || '',
    });

    return res.status(201).json({
      message: 'Credential cached',
      credentialId,
      credentialHash,
    });
  } catch (err) {
    logger.error('[/credential/issue] Error caching credential', err);
    return res.status(500).json({ error: 'Failed to cache credential' });
  }
});

// POST /credential/revoke
// Revocation is now performed on-chain via the Issuer Dashboard (MetaMask).
router.post('/revoke', async (req, res) => {
  return res.status(410).json({
    error: 'Endpoint deprecated.',
    note: 'Revocation is performed on-chain via the Issuer Dashboard (MetaMask). This endpoint no longer marks credentials as revoked.',
  });
});

// GET /credential/:id
router.get('/:id', async (req, res) => {
  try {
    const cred = getCredential(req.params.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    // Use credentialHash for on-chain revocation check (new flow), fallback to credentialId
    const revocationHash = cred.credentialHash || req.params.id;
    const onChainRevoked = await blockchain.isCredentialRevoked(revocationHash).catch(() => null);

    return res.json({ ...cred, onChainRevoked: onChainRevoked ?? cred.revoked });
  } catch (err) {
    logger.error('[/credential/:id] Error fetching credential', err);
    return res.status(500).json({ error: 'Failed to fetch credential' });
  }
});

module.exports = router;
