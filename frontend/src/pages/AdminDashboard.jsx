import { useState } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import { useToast } from '../components/Toast'
import { connectWallet, walletError, getReadProvider } from '../services/wallet'
import { addIssuer, removeIssuer, isAuthorizedIssuer, getOwner, CONTRACT_ADDRESS } from '../services/contract'

const TABS = [
  { id: 'connect', label: 'Kết nối ví' },
  { id: 'manage', label: 'Quản lý Issuer' },
]

function short(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
}

export default function AdminDashboard() {
  const toast = useToast()
  const [tab, setTab] = useState('connect')
  const [wallet, setWallet] = useState(null)   // { address, signer, chainId }
  const [isOwner, setIsOwner] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Manage tab state
  const [addAddr, setAddAddr] = useState('')
  const [removeAddr, setRemoveAddr] = useState('')
  const [checkAddr, setCheckAddr] = useState('')
  const [checkResult, setCheckResult] = useState(null)
  const [loading, setLoading] = useState('')

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const w = await connectWallet()
      setWallet(w)
      // Check if connected wallet is contract owner
      const ownerAddr = await getOwner(w.provider)
      const ok = ownerAddr.toLowerCase() === w.address.toLowerCase()
      setIsOwner(ok)
      if (ok) {
        toast.success(`Kết nối thành công! Ví này là Owner của contract.`)
        setTab('manage')
      } else {
        toast.error(`Ví này KHÔNG phải Owner. Owner: ${short(ownerAddr)}`)
      }
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setConnecting(false)
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
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading('')
    }
  }

  const handleRemove = async () => {
    if (!removeAddr.trim()) return toast.error('Nhập địa chỉ issuer')
    if (!/^0x[0-9a-fA-F]{40}$/.test(removeAddr)) return toast.error('Địa chỉ không hợp lệ')
    setLoading('remove')
    try {
      await removeIssuer(wallet.signer, removeAddr)
      toast.success(`Đã xóa issuer: ${short(removeAddr)}`)
      setRemoveAddr('')
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading('')
    }
  }

  const handleCheck = async () => {
    if (!checkAddr.trim()) return toast.error('Nhập địa chỉ cần kiểm tra')
    setLoading('check')
    try {
      const provider = wallet?.provider || await getReadProvider()
      const result = await isAuthorizedIssuer(provider, checkAddr)
      setCheckResult({ address: checkAddr, authorized: result })
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading('')
    }
  }

  const fillHardhatOwner = () => {
    toast.info('Đã điền Account #0 (Hardhat owner). Kết nối MetaMask vào mạng localhost:8545.')
  }

  return (
    <DashboardLayout title="Admin — Quản lý Issuer" subtitle="Thêm/xóa tổ chức cấp bằng được ủy quyền trên blockchain">
      {/* Contract info bar */}
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
              </div>
            ) : (
              <Button onClick={handleConnect} disabled={connecting} className="w-full">
                {connecting ? 'Đang kết nối...' : '🦊 Kết nối MetaMask'}
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Quản lý Issuer ── */}
      {tab === 'manage' && (
        <div className="max-w-2xl space-y-5">
          {!wallet || !isOwner ? (
            <Card>
              <p className="text-yellow-400 text-sm">⚠ Cần kết nối ví Owner trước. Quay lại tab "Kết nối ví".</p>
            </Card>
          ) : (
            <>
              {/* Add issuer */}
              <Card>
                <h2 className="text-base font-semibold text-white mb-1">Thêm Issuer</h2>
                <p className="text-xs text-[#555] mb-4">Địa chỉ ví Ethereum của trường đại học / tổ chức cấp bằng.</p>
                <div className="flex gap-3">
                  <Input
                    placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    value={addAddr}
                    onChange={e => setAddAddr(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAdd} disabled={loading === 'add'}>
                    {loading === 'add' ? '...' : 'Thêm'}
                  </Button>
                </div>
                <p className="text-xs text-[#444] mt-2">
                  Hardhat Account #1: <button className="font-mono text-[#6c47ff] hover:underline" onClick={() => setAddAddr('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')}>0x7099...c8</button>
                </p>
              </Card>

              {/* Remove issuer */}
              <Card>
                <h2 className="text-base font-semibold text-white mb-1">Xóa Issuer</h2>
                <p className="text-xs text-[#555] mb-4">Thu hồi quyền cấp bằng của một tổ chức.</p>
                <div className="flex gap-3">
                  <Input
                    placeholder="0x..."
                    value={removeAddr}
                    onChange={e => setRemoveAddr(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="danger" onClick={handleRemove} disabled={loading === 'remove'}>
                    {loading === 'remove' ? '...' : 'Xóa'}
                  </Button>
                </div>
              </Card>

              {/* Check issuer */}
              <Card>
                <h2 className="text-base font-semibold text-white mb-1">Kiểm tra quyền Issuer</h2>
                <div className="flex gap-3">
                  <Input
                    placeholder="0x..."
                    value={checkAddr}
                    onChange={e => { setCheckAddr(e.target.value); setCheckResult(null) }}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={handleCheck} disabled={loading === 'check'}>
                    {loading === 'check' ? '...' : 'Kiểm tra'}
                  </Button>
                </div>
                {checkResult && (
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant={checkResult.authorized ? 'green' : 'red'}>
                      {checkResult.authorized ? 'Authorized' : 'Not Authorized'}
                    </Badge>
                    <span className="font-mono text-xs text-[#888]">{short(checkResult.address)}</span>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
