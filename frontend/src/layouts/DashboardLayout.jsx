import Navbar from '../components/Navbar'
import { useWallet } from '../contexts/WalletContext'

export default function DashboardLayout({ children, title, subtitle }) {
  const { wallet, switchToHardhat } = useWallet()
  const wrongChain = wallet && Number(wallet.chainId) !== 31337

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <div className="pt-14">
        {/* Wrong chain banner */}
        {wrongChain && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 flex items-center justify-center gap-4 text-xs text-red-400">
            <span>⚠ MetaMask đang ở <strong>Chain {wallet.chainId}</strong> — cần chuyển sang <strong>Hardhat Localhost (Chain 31337)</strong></span>
            <button
              onClick={switchToHardhat}
              className="shrink-0 px-3 py-1 rounded-full border border-red-500/40 hover:border-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Chuyển mạng ngay
            </button>
          </div>
        )}
        {/* Page header */}
        <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-[#888] text-sm mt-1">{subtitle}</p>}
          </div>
        </div>
        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </div>
    </div>
  )
}
