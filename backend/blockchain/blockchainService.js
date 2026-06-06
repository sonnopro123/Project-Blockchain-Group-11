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
  if (!rpcUrl) {
    console.warn('[blockchain] RPC_URL not set — blockchain features disabled');
    return;
  }
  if (!ownerPrivateKey) {
    console.warn('[blockchain] OWNER_PRIVATE_KEY not set — blockchain features disabled');
    return;
  }
  provider = new ethers.JsonRpcProvider(rpcUrl);
  ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);

  if (!contractAddress) {
    console.warn('[blockchain] CONTRACT_ADDRESS is empty — deploy contract first, then restart backend');
    return;
  }
  contract = new ethers.Contract(contractAddress, contractABI, ownerWallet);
  console.log('[blockchain] Contract ready at', contractAddress);
}

function _ensureInit() {
  if (!contract) {
    throw new Error(
      'CONTRACT_ADDRESS chưa được cấu hình. ' +
      'Chạy: npx hardhat run scripts/deploy.js --network localhost, sau đó restart backend.'
    );
  }
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
