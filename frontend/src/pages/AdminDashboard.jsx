import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import { useToast } from '../components/Toast'
import { walletError, getReadProvider } from '../services/wallet'
import {
  addIssuer, removeIssuer, isAuthorizedIssuer,
  getOwner, getAuthorizedIssuers, CONTRACT_ADDRESS,
} from '../services/contract'
import { useWallet } from '../contexts/WalletContext'
import ConnectButton from '../components/ConnectButton'

const TABS = [
  { id: 'connect', label: 'Kết nối ví' },
  { id: 'manage',  label: 'Quản lý Issuer' },
]

function short(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '' }

export default function AdminDashboard() {
  const toast = useToast()
  const { wallet } = useWallet()
  const [tab, setTab]       = useState('connect')
  const [isOwner, setIsOwner] = useState(false)
  const [issuers, setIssuers] = useState([])        // authorized issuer list
  const [loadingList, setLoadingList] = useState(false)

  const [addAddr, setAddAddr]   = useState('')
  const [loading, setLoading]   = useState('')

  const isWrongChain = wallet && Number(wallet.chainId) !== 31337

  // Re-check owner whenever wallet changes (e.g. user switches account)
  useEffect(() => {
    if (!wallet) { setIsOwner(false); return }
    getOwner(wallet.provider)
      .then(ownerAddr => setIsOwner(ownerAddr.toLowerCase() === wallet.address.toLowerCase()))
      .catch(() => setIsOwner(false))
  }, [wallet?.address, wallet?.chainId])

  // Load issuer list
  const loadIssuers = useCallback(async () => {
    const provider = wallet?.provider || await getReadProvider().catch(() => null)
    if (!provider) { setIssuers([]); return }
    setLoadingList(true)
    try {
      const list = await getAuthorizedIssuers(provider)
      setIssuers(list)
    } catch {
      // silently ignore if events not available
    } finally {
      setLoadingList(false)
    }
  }, [wallet?.address])

  // Load list when entering manage tab
  useEffect(() => {
    if (tab === 'manage') loadIssuers()
  }, [tab, loadIssuers])

  const handleConnect = async (w) => {
    if (Number(w.chainId) !== 31337) {
      toast.error('Cần chuyển MetaMask sang mạng Hardhat Localhost (Chain 31337) trước.')
      return
    }
    try {
      const ownerAddr = await getOwner(w.provider)
      const ok = ownerAddr.toLowerCase() === w.address.toLowerCase()
      setIsOwner(ok)
      if (ok) {
        toast.success('Kết nối thành công! Ví này là Owner của contract.')
        setTab('manage')
      } else {
        toast.error(`Ví này KHÔNG phải Owner. Owner: ${short(ownerAddr)}`)
      }
    } catch (e) {
      toast.error(walletError(e))
    }
  }

  const handleAdd = async () => {
    if (!addAddr.trim()) return toast.error('Nhập địa chỉ issuer')
    if (!/^0x[0-9a-fA-F]{40}$/.test(addAddr)) return toast.error('Địa chỉ không hợp lệ')
    setLoading('add')
    try {
      await addIssuer(wallet.signer, addAddr)
      toast.success(`Đã thêm issuer: ${short(addAddr)}`)
      setAddAddr('')
      await loadIssuers()
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading('')
    }
  }

  const handleRemoveFromList = async (addr) => {
    setLoading('remove_' + addr)
    try {
      await removeIssuer(wallet.signer, addr)
      toast.success(`Đã xóa issuer: ${short(addr)}`)
      await loadIssuers()
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading('')
    }
  }

  return (
    <DashboardLayout title="Admin — Quản lý Issuer" subtitle="Thêm/xóa tổ chức cấp bằng được ủy quyền trên blockchain">
      {/* Wrong chain warning */}
      {isWrongChain && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
          <span>⚠</span>
          <span>MetaMask đang ở <strong>Chain {wallet.chainId}</strong> — cần chuyển sang <strong>Hardhat Localhost (Chain 31337)</strong>. RPC: http://127.0.0.1:8545</span>
        </div>
      )}

      {/* Contract bar */}
      <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-[#0d0d0d] border border-[#1d1d1d] rounded-xl text-xs text-[#555]">
        <span className="text-[#444] uppercase tracking-widest">Contract</span>
        <span className="font-mono text-[#666]">{CONTRACT_ADDRESS || '(chưa cấu hình — điền VITE_CONTRACT_ADDRESS trong frontend/.env)'}</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border border-[#1d1d1d] bg-[#0d0d0d] rounded-full p-1 w-fit mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              tab === t.id ? 'bg-[#1d1d1d] text-white' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {t.label}
            {t.id === 'connect' && wallet && <span className="ml-2 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
            {t.id === 'manage' && issuers.length > 0 && (
              <span className="ml-2 text-xs bg-[#6c47ff]/20 text-[#6c47ff] rounded-full px-1.5">{issuers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Kết nối ── */}
      {tab === 'connect' && (
        <div className="max-w-lg space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-white mb-1">Kết nối ví Admin</h2>
            <p className="text-xs text-[#555] mb-5 leading-relaxed">
              Chỉ địa chỉ <span className="text-white">owner</span> của contract mới có thể thêm/xóa issuer.
              Khi deploy contract với Hardhat, Account #0 là owner mặc định.
            </p>
            <div className="flex items-start gap-2 bg-[#0f1520] border border-[#1a2a3a] rounded-xl px-4 py-3 mb-5">
              <span className="text-blue-400 shrink-0 mt-0.5">ℹ</span>
              <p className="text-xs text-[#888] leading-relaxed">
                Hardhat Account #0: <span className="font-mono text-[#aaa]">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</span><br/>
                Thêm mạng localhost:8545 (chainId 31337) vào MetaMask và import Account #0.
              </p>
            </div>

            {wallet ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={isOwner ? 'green' : 'red'}>{isOwner ? 'Owner' : 'Không phải Owner'}</Badge>
                  <span className="font-mono text-sm text-[#aaa]">{short(wallet.address)}</span>
                  <span className="text-xs text-[#555]">Chain {wallet.chainId}</span>
                </div>
                {isOwner && (
                  <p className="text-xs text-[#6c47ff]">✓ Có thể quản lý issuer — chuyển sang tab "Quản lý Issuer"</p>
                )}
                <ConnectButton onConnected={handleConnect} label="🔄 Đổi ví Admin" />
              </div>
            ) : (
              <ConnectButton onConnected={handleConnect} />
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Quản lý Issuer ── */}
      {tab === 'manage' && (
        <div className="max-w-2xl space-y-5">
          {/* Authorized Issuers List — visible to everyone */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Danh sách Issuer đang hoạt động</h2>
              <button
                onClick={loadIssuers}
                disabled={loadingList}
                className="text-xs text-[#555] hover:text-[#888] transition-colors"
              >
                {loadingList ? '...' : '↻ Tải lại'}
              </button>
            </div>

            {loadingList ? (
              <p className="text-xs text-[#555] py-2">Đang tải...</p>
            ) : issuers.length === 0 ? (
              <p className="text-xs text-[#444] py-2">Chưa có issuer nào được ủy quyền.</p>
            ) : (
              <div className="space-y-2">
                {issuers.map(addr => (
                  <div key={addr} className="flex items-center gap-3 px-3 py-2.5 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-mono text-xs text-[#aaa] flex-1 truncate">{addr}</span>
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveFromList(addr)}
                        disabled={loading === 'remove_' + addr}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                      >
                        {loading === 'remove_' + addr ? '...' : 'Xóa'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Add issuer — only owner */}
          {isOwner ? (
            <Card>
              <h2 className="text-base font-semibold text-white mb-1">Thêm Issuer mới</h2>
              <p className="text-xs text-[#555] mb-4">Địa chỉ ví Ethereum của trường đại học / tổ chức cấp bằng.</p>
              <div className="flex gap-3">
                <Input
                  placeholder="0x..."
                  value={addAddr}
                  onChange={e => setAddAddr(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAdd} disabled={loading === 'add'}>
                  {loading === 'add' ? '...' : 'Thêm'}
                </Button>
              </div>
              <p className="text-xs text-[#444] mt-2">
                Hardhat Account #1:{' '}
                <button
                  className="font-mono text-[#6c47ff] hover:underline"
                  onClick={() => setAddAddr('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')}
                >
                  0x7099...79C8
                </button>
              </p>
            </Card>
          ) : (
            <Card>
              <p className="text-xs text-[#555]">⚠ Chỉ Owner contract mới có thể thêm/xóa issuer. Kết nối ví Owner ở tab "Kết nối ví".</p>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
