/**
 * POST /issuer/register
 *
 * Request body:
 *   {
 *     "name": "Hanoi University of Science and Technology",
 *     "ethAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
 *   }
 *
 * Flow:
 *   1. Generate ECC key pair (off-chain signing)
 *   2. Register issuer on-chain via owner wallet (addIssuer is onlyOwner)
 *   3. Store issuer off-chain (ECC keys only — no Ethereum private keys stored)
 *
 * Note: On-chain revocation is signed by the issuer via MetaMask in the web UI.
 *       The backend does NOT hold any Ethereum private keys for issuers.
 */

const express = require('express');
const router = express.Router();
const { generateIssuerKeyPair } = require('../services/eccService');
const { saveIssuer, getIssuer } = require('../storage/db');
const blockchain = require('../blockchain/blockchainService');
const logger = require('../services/logger');

router.post('/register', async (req, res) => {
  try {
    const { name, ethAddress } = req.body;

    if (!name || !ethAddress) {
      return res.status(400).json({
        error: 'name and ethAddress are required',
      });
    }

    // Basic Ethereum address format check
    if (!/^0x[0-9a-fA-F]{40}$/.test(ethAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    if (getIssuer(ethAddress)) {
      return res.status(409).json({ error: 'Issuer already registered' });
    }

    // 1. Generate ECC key pair for off-chain credential signing
    const { privateKey: eccPrivateKey, publicKey: eccPublicKey } = generateIssuerKeyPair();

    // 2. Register issuer on-chain (owner wallet pays gas, addIssuer is onlyOwner)
    await blockchain.registerIssuerOnChain(ethAddress);

    // 3. Store off-chain — ECC private key stored to sign credentials server-side
    //    No Ethereum private keys are stored; on-chain actions use MetaMask in the UI
    saveIssuer(ethAddress, {
      name,
      publicKey: eccPublicKey,
      eccPrivateKey,
      ethAddress,
    });

    return res.status(201).json({
      message: 'Issuer registered successfully',
      issuer: {
        ethAddress,
        name,
        eccPublicKey,
        eccPrivateKey,
      },
    });
  } catch (err) {
    logger.error('[/issuer/register] Error registering issuer', err);
    return res.status(500).json({ error: 'Failed to register issuer' });
  }
});

module.exports = router;
