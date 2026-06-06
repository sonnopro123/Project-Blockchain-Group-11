import { useWallet } from '../contexts/WalletContext'
import { walletError } from '../services/wallet'
import Button from './Button'
import Badge from './Badge'

function short(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '' }

/**
 * Reusable connect button.
 * Shows wallet address + green dot when connected.
 * Shows error + "Thử lại" button when connection fails.
 * onConnected(wallet) — optional callback after successful connect.
 */
export default function ConnectButton({ onConnected, label = '🦊 Kết nối MetaMask', className = '' }) {
  const { wallet, connecting, connectError, connect } = useWallet()

  const handleConnect = async () => {
    try {
      const w = await connect()
      onConnected?.(w)
    } catch {
      // error stored in connectError
    }
  }

  // When wallet already set AND label is the default → show address + "Đổi ví" link
  if (wallet && label === '🦊 Kết nối MetaMask') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="green">{short(wallet.address)}</Badge>
        <span className="text-xs text-[#555]">Chain {wallet.chainId}</span>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="text-xs text-[#6c47ff] hover:text-white transition-colors underline underline-offset-2"
        >
          {connecting ? '...' : 'Đổi ví'}
        </button>
      </div>
    )
  }

  // Custom label (e.g. "🔄 Đổi ví Issuer") → always render as button
  return (
    <div className={`space-y-2 ${className}`}>
      <Button onClick={handleConnect} disabled={connecting} className="w-full">
        {connecting ? 'Đang kết nối...' : label}
      </Button>
      {connectError && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <span className="flex-1 truncate">{walletError({ message: connectError })}</span>
          <button
            onClick={handleConnect}
            className="shrink-0 border border-red-500/30 hover:border-red-500/60 text-red-400 hover:text-red-300 px-3 py-1 rounded-full transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}
    </div>
  )
}
