import { BrowserProvider, JsonRpcProvider } from 'ethers'

/**
 * Connect MetaMask and return { provider, signer, address, chainId }.
 * Throws if MetaMask is not installed or user rejects.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask chưa được cài đặt. Truy cập metamask.io để cài.')
  }
  const provider = new BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()
  return { provider, signer, address, chainId: Number(network.chainId) }
}

/**
 * Returns a read-only provider.
 * Uses MetaMask provider if available, otherwise falls back to localhost RPC.
 */
export async function getReadProvider() {
  if (window.ethereum) {
    return new BrowserProvider(window.ethereum)
  }
  const rpc = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'
  return new JsonRpcProvider(rpc)
}

/**
 * Friendly error messages for common MetaMask errors.
 */
export function walletError(err) {
  const msg = err?.message || String(err)
  if (msg.includes('user rejected') || msg.includes('User denied') || err?.code === 4001) {
    return 'Giao dịch bị hủy bởi người dùng.'
  }
  if (msg.includes('MetaMask chưa')) return msg
  if (msg.includes('network changed') || msg.includes('underlying network changed')) {
    return 'Mạng đã thay đổi. Hãy làm mới trang.'
  }
  if (msg.includes('insufficient funds')) return 'Không đủ ETH để trả phí gas.'
  if (msg.includes('Credential not issued')) return 'Credential này chưa được đăng ký on-chain. Hãy phát hành lại văn bằng (bước 2/2 đăng ký on-chain) trước khi thu hồi.'
  if (msg.includes('Already issued')) return 'Credential hash này đã được đăng ký on-chain trước đó.'
  if (msg.includes('Already revoked')) return 'Credential này đã bị thu hồi trước đó.'
  if (msg.includes('Only issuing issuer')) return 'Chỉ issuer đã cấp văn bằng này mới được thu hồi.'
  if (msg.includes('Not authorized issuer')) return 'Ví này chưa được Admin ủy quyền làm Issuer.'
  return msg.length > 120 ? msg.slice(0, 120) + '...' : msg
}
