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

export async function issueCredential(signer, credentialHash) {
  const tx = await getContract(signer).issueCredential(credentialHash)
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

export async function getCredentialIssuer(provider, credentialHash) {
  return getContract(provider).credentialIssuers(credentialHash)
}

export async function getOwner(provider) {
  return getContract(provider).owner()
}

// Returns list of currently authorized issuers by replaying events in chronological order
export async function getAuthorizedIssuers(provider) {
  const contract = getContract(provider)
  const [added, removed] = await Promise.all([
    contract.queryFilter(contract.filters.IssuerAdded()),
    contract.queryFilter(contract.filters.IssuerRemoved()),
  ])

  // Merge and sort by block + log index to get correct timeline
  const events = [
    ...added.map(e => ({ type: 'add', addr: e.args[0], block: e.blockNumber, idx: e.index ?? e.logIndex ?? 0 })),
    ...removed.map(e => ({ type: 'remove', addr: e.args[0], block: e.blockNumber, idx: e.index ?? e.logIndex ?? 0 })),
  ].sort((a, b) => a.block - b.block || a.idx - b.idx)

  // Replay events in order — handles re-add after remove correctly
  const authorized = new Set()
  const originalCase = {}
  for (const e of events) {
    const key = e.addr.toLowerCase()
    if (e.type === 'add') {
      authorized.add(key)
      originalCase[key] = e.addr
    } else {
      authorized.delete(key)
    }
  }

  return [...authorized].map(key => originalCase[key])
}
