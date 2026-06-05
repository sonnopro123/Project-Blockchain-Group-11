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
  return msg.length > 120 ? msg.slice(0, 120) + '...' : msg
}
