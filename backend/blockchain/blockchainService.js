/**
 * MODULE E — BLOCKCHAIN SERVICE
 * Connects to an Ethereum node, interacts with CredentialRegistry smart contract.
 *
 * Contract functions available:
 *   addIssuer(address)            onlyOwner
 *   removeIssuer(address)         onlyOwner
 *   revokeCredential(bytes32)     onlyAuthorizedIssuer
 *   isAuthorizedIssuer(address)   view
 *   isRevoked(bytes32)            view
 */

const { ethers } = require('ethers');
const artifact = require('../../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json');
const contractABI = artifact.abi;

let provider;
let ownerWallet;
let contract;

function init(rpcUrl, ownerPrivateKey, contractAddress) {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
  contract = new ethers.Contract(contractAddress, contractABI, ownerWallet);
}

function _ensureInit() {
  if (!contract) throw new Error('blockchainService not initialized. Call init() first.');
}

function _contractAs(privateKey) {
  const signerWallet = new ethers.Wallet(privateKey, provider);
  return contract.connect(signerWallet);
}

// ---------------------------------------------------------------------------
// Issuer management (owner-only on-chain)
// ---------------------------------------------------------------------------

async function registerIssuerOnChain(issuerAddress) {
  _ensureInit();
  const tx = await contract.addIssuer(issuerAddress);
  return tx.wait();
}

async function removeIssuerOnChain(issuerAddress) {
  _ensureInit();
  const tx = await contract.removeIssuer(issuerAddress);
  return tx.wait();
}

async function isIssuerAuthorized(issuerAddress) {
  _ensureInit();
  return contract.isAuthorizedIssuer(issuerAddress);
}

// ---------------------------------------------------------------------------
// Revocation (onlyAuthorizedIssuer)
// ---------------------------------------------------------------------------

async function revokeCredentialOnChain(credentialId, issuerEthPrivateKey) {
  _ensureInit();
  const issuerContract = _contractAs(issuerEthPrivateKey);
  const tx = await issuerContract.revokeCredential(credentialId);
  return tx.wait();
}

// ---------------------------------------------------------------------------
// Read-only helpers
// ---------------------------------------------------------------------------

async function isCredentialRevoked(credentialId) {
  _ensureInit();
  return contract.isRevoked(credentialId);
}

module.exports = {
  init,
  registerIssuerOnChain,
  removeIssuerOnChain,
  isIssuerAuthorized,
  revokeCredentialOnChain,
  isCredentialRevoked,
};
