/**
 * POST /issuer/register
 *
 * Request body:
 *   {
 *     "name": "Hanoi University of Science and Technology",
 *     "ethAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",   // Hardhat account address
 *     "ethPrivateKey": "0xac0974bec39..."                              // Hardhat account private key
 *   }
 *
 * Flow:
 *   1. Generate ECC key pair (off-chain signing)
 *   2. Register issuer on-chain via owner wallet (registerIssuer is onlyOwner)
 *   3. Store issuer off-chain (ECC keys + Ethereum keys)
 */

const express = require('express');
const router = express.Router();
const { generateIssuerKeyPair } = require('../services/eccService');
const { saveIssuer, getIssuer } = require('../storage/db');
const blockchain = require('../blockchain/blockchainService');

router.post('/register', async (req, res) => {
  try {
    const { name, ethAddress, ethPrivateKey } = req.body;

    if (!name || !ethAddress || !ethPrivateKey) {
      return res.status(400).json({
        error: 'name, ethAddress, and ethPrivateKey are required',
        hint: 'Use a Hardhat test account address and private key',
      });
    }

    if (getIssuer(ethAddress)) {
      return res.status(409).json({ error: 'Issuer already registered' });
    }

    // 1. Generate ECC key pair for off-chain credential signing
    const { privateKey: eccPrivateKey, publicKey: eccPublicKey } = generateIssuerKeyPair();

    // 2. Register issuer on-chain (owner wallet pays gas, registerIssuer is onlyOwner)
    await blockchain.registerIssuerOnChain(ethAddress);

    // 3. Store off-chain (including ECC private key so backend can sign without client re-sending it)
    saveIssuer(ethAddress, {
      name,
      publicKey: eccPublicKey,
      eccPrivateKey,
      ethAddress,
      ethPrivateKey,
    });

    return res.status(201).json({
      message: 'Issuer registered successfully',
      issuer: {
        ethAddress,
        name,
        eccPublicKey,
        // Return ECC private key once — issuer must store this for signing credentials
        eccPrivateKey,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
