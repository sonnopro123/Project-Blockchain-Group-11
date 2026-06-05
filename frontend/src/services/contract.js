import { Contract } from 'ethers'
import { CONTRACT_ABI } from '../config/abi'

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ''

function getContract(signerOrProvider) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('VITE_CONTRACT_ADDRESS chưa được cấu hình. Chạy deploy script và điền địa chỉ vào frontend/.env.')
  }
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider)
}

// ─── Write (requires signer) ─────────────────────────────────────────────────

export async function addIssuer(signer, issuerAddress) {
  const tx = await getContract(signer).addIssuer(issuerAddress)
  return tx.wait()
}

export async function removeIssuer(signer, issuerAddress) {
  const tx = await getContract(signer).removeIssuer(issuerAddress)
  return tx.wait()
}

export async function revokeCredential(signer, credentialHash) {
  const tx = await getContract(signer).revokeCredential(credentialHash)
  return tx.wait()
}

// ─── Read (provider or signer) ───────────────────────────────────────────────

export async function isAuthorizedIssuer(provider, address) {
  return getContract(provider).isAuthorizedIssuer(address)
}

export async function isRevoked(provider, credentialHash) {
  return getContract(provider).isRevoked(credentialHash)
}

export async function getOwner(provider) {
  return getContract(provider).owner()
}
