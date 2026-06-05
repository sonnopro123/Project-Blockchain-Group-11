// ABI generated from: contracts/CredentialRegistry.sol
// Compiled with Hardhat — do not edit manually.
export const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "credentialHash", "type": "bytes32" }, { "indexed": true, "name": "revokedBy", "type": "address" }], "name": "CredentialRevoked", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "issuer", "type": "address" }], "name": "IssuerAdded", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "issuer", "type": "address" }], "name": "IssuerRemoved", "type": "event" },
  { "inputs": [{ "name": "issuer", "type": "address" }], "name": "addIssuer", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "", "type": "address" }], "name": "authorizedIssuers", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "issuer", "type": "address" }], "name": "isAuthorizedIssuer", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "credentialHash", "type": "bytes32" }], "name": "isRevoked", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "issuer", "type": "address" }], "name": "removeIssuer", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "credentialHash", "type": "bytes32" }], "name": "revokeCredential", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "", "type": "bytes32" }], "name": "revokedCredentials", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
]
