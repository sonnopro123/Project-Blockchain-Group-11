import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import CopyField from '../components/CopyField'
import CourseInput from '../components/CourseInput'
import WorkflowStepper from '../components/WorkflowStepper'
import Tooltip from '../components/Tooltip'
import { useToast } from '../components/Toast'
import { walletError } from '../services/wallet'
import { isAuthorizedIssuer, issueCredential, revokeCredential, CONTRACT_ADDRESS } from '../services/contract'
import {
  computeCredentialId, computeCredentialHash, signCredential,
} from '../services/credential'
import { generateRoot as merkleRoot } from '../services/merkle'
import { downloadJSON } from '../utils/download'
import { useWallet } from '../contexts/WalletContext'
import ConnectButton from '../components/ConnectButton'

const TABS = [
  { id: 'connect', label: 'Kết nối ví' },
  { id: 'issue',   label: 'Phát hành văn bằng' },
  { id: 'revoke',  label: 'Thu hồi văn bằng' },
]
const WORKFLOW = ['Kết nối ví', 'Phát hành', 'Thu hồi (nếu cần)']

function short(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '' }

// ── Tab 1: Connect ────────────────────────────────────────────────────────────
function ConnectTab({ wallet, authorized, onConnected }) {
  const toast = useToast()

  const handleConnected = async (w) => {
    try {
      const auth = await isAuthorizedIssuer(w.provider, w.address)
      onConnected(auth)
      if (auth) {
        toast.success('Đã kết nối! Ví này là Authorized Issuer.')
      } else {
        toast.info('Kết nối thành công. Ví này chưa được Admin ủy quyền làm Issuer.')
      }
    } catch (e) {
      toast.error(walletError(e))
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-white mb-1">Kết nối ví Tổ chức</h2>
        <p className="text-xs text-[#555] mb-5 leading-relaxed">
          Mỗi tổ chức cấp bằng dùng một ví Ethereum riêng. Admin phải thêm ví này vào contract trước.
        </p>
        <div className="flex items-start gap-2 bg-[#0f1520] border border-[#1a2a3a] rounded-xl px-4 py-3 mb-5">
          <span className="text-blue-400 shrink-0 mt-0.5">ℹ</span>
          <p className="text-xs text-[#888] leading-relaxed">
            Hardhat Account #1 (issuer mặc định):<br/>
            <span className="font-mono text-[#aaa]">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
          </p>
        </div>
        {wallet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={authorized ? 'green' : 'yellow'}>
                {authorized ? 'Authorized Issuer' : 'Chưa được ủy quyền'}
              </Badge>
              <span className="font-mono text-sm text-[#aaa]">{short(wallet.address)}</span>
              <span className="text-xs text-[#555]">Chain {wallet.chainId}</span>
            </div>
            {!authorized && (
              <p className="text-xs text-yellow-500">⚠ Nhờ Admin chạy addIssuer({short(wallet.address)}) trước khi phát hành.</p>
            )}
            {authorized && (
              <p className="text-xs text-[#6c47ff]">✓ Có thể phát hành văn bằng — chuyển sang tab "Phát hành văn bằng"</p>
            )}
            <ConnectButton onConnected={handleConnected} label="🔄 Đổi ví Issuer" />
          </div>
        ) : (
          <ConnectButton onConnected={handleConnected} />
        )}
      </Card>
    </div>
  )
}

// ── Tab 2: Issue ──────────────────────────────────────────────────────────────
function IssueTab({ wallet, authorized }) {
  const toast = useToast()
  const resultRef = useRef(null)

  const [form, setForm] = useState({
    universityName: '',
    studentWallet: '',
    studentName: '',
    studentId: '',
  })
  const [courses, setCourses] = useState([{ courseCode: '', courseName: '', grade: '' }])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(() => {
    // Restore last issued credential from localStorage on mount
    try {
      const saved = localStorage.getItem('credproof_last_credential')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [result])

  const addCourse    = () => setCourses([...courses, { courseCode: '', courseName: '', grade: '' }])
  const removeCourse = i => setCourses(courses.filter((_, idx) => idx !== i))
  const updateCourse = (i, field, val) => {
    const next = [...courses]; next[i][field] = val; setCourses(next)
  }
  const selectCourse = (i, course) => {
    const next = [...courses]
    next[i] = { courseCode: course.courseCode, courseName: course.courseName, grade: course.grade }
    setCourses(next)
  }

  const validate = () => {
    const errs = {}
    if (!form.universityName.trim()) errs.universityName = 'Nhập tên trường'
    if (!form.studentWallet.trim()) errs.studentWallet = 'Nhập ví sinh viên'
    else if (!/^0x[0-9a-fA-F]{40}$/.test(form.studentWallet)) errs.studentWallet = 'Địa chỉ ví không hợp lệ'
    if (!form.studentId.trim()) errs.studentId = 'Nhập mã sinh viên'
    const filled = courses.filter(c => c.courseCode && c.grade)
    if (filled.length === 0) errs.courses = 'Cần ít nhất 1 môn học có mã và điểm'
    return errs
  }

  const handleIssue = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})

    // Double-check on-chain authorization right before signing
    const stillAuthorized = await isAuthorizedIssuer(wallet.provider, wallet.address).catch(() => false)
    if (!stillAuthorized) {
      toast.error(`Ví ${wallet.address.slice(0,10)}... chưa được ủy quyền làm Issuer. Nhờ Admin thêm vào contract trước.`)
      return
    }

    setLoading(true)
    try {
      const filled = courses.filter(c => c.courseCode && c.grade)
      const issuedAt = new Date().toISOString()
      const credentialId = computeCredentialId(form.studentWallet, wallet.address, issuedAt)
      const mRoot = merkleRoot(filled)

      const base = {
        credentialId,
        studentWallet: form.studentWallet,
        studentName: form.studentName,
        studentId: form.studentId,
        issuerWallet: wallet.address,
        universityName: form.universityName,
        merkleRoot: mRoot,
        courses: filled,
        issuedAt,
        chainId: wallet.chainId,
        contractAddress: CONTRACT_ADDRESS,
      }

      const credentialHash = computeCredentialHash(base)

      // MetaMask popup — issuer signs credential hash (EIP-191 personal_sign, no gas)
      toast.info('MetaMask sẽ hiện popup để ký văn bằng...')
      const issuerSignature = await signCredential(wallet.signer, credentialHash)

      const credential = {
        schemaVersion: '1.0',
        ...base,
        credentialHash,
        issuerSignature,
      }
      delete credential._meta

      localStorage.setItem('credproof_last_credential', JSON.stringify(credential))
      setResult(credential)
      toast.success('Văn bằng đã được ký thành công!')
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    downloadJSON(result, `credential-${result.studentId}-${Date.now()}.json`)
    toast.success('Đã tải xuống credential JSON')
  }

  const handleClear = () => {
    localStorage.removeItem('credproof_last_credential')
    setResult(null)
    toast.info('Đã xóa. Có thể phát hành văn bằng mới.')
  }

  if (!wallet) {
    return (
      <Card><p className="text-yellow-400 text-sm">⚠ Kết nối ví Issuer trước ở tab "Kết nối ví".</p></Card>
    )
  }

  if (!authorized) {
    return (
      <Card>
        <p className="text-yellow-400 text-sm font-semibold mb-1">⚠ Ví này chưa được Admin ủy quyền làm Issuer.</p>
        <p className="text-[#555] text-xs leading-relaxed">
          Địa chỉ hiện tại: <span className="font-mono text-[#888]">{wallet.address}</span><br/>
          Nhờ Admin vào tab Admin → Quản lý Issuer → Thêm địa chỉ này vào danh sách Authorized Issuer.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Thông tin văn bằng</h2>
          <div className="flex items-center gap-2">
            <Badge variant="green">Ký bằng MetaMask</Badge>
            <span className="text-xs text-[#555] font-mono">{short(wallet.address)}</span>
          </div>
        </div>
        <div className="space-y-4">
          <Input
            label="Tên trường / tổ chức"
            placeholder="VD: Đại học Bách khoa Hà Nội"
            value={form.universityName}
            error={errors.universityName}
            onChange={e => setForm({ ...form, universityName: e.target.value })}
          />
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-sm font-medium text-[#888]">Ví Ethereum của sinh viên</label>
              <Tooltip text="Địa chỉ ví MetaMask của sinh viên. Sinh viên phải kết nối ví này để xem và tạo proof." />
            </div>
            <Input
              placeholder="0x..."
              value={form.studentWallet}
              error={errors.studentWallet}
              onChange={e => setForm({ ...form, studentWallet: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Mã sinh viên"
              placeholder="SV-2021-001"
              value={form.studentId}
              error={errors.studentId}
              onChange={e => setForm({ ...form, studentId: e.target.value })}
            />
            <Input
              label="Họ tên sinh viên"
              placeholder="Nguyễn Văn A"
              value={form.studentName}
              onChange={e => setForm({ ...form, studentName: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Bảng điểm (Merkle leaves)</h2>
            <p className="text-xs text-[#555] mt-0.5">Mỗi môn học là một leaf trong Merkle Tree</p>
          </div>
          <Button variant="ghost" size="sm" onClick={addCourse}>+ Thêm môn</Button>
        </div>
        <div className="space-y-3">
          {courses.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <CourseInput
                value={c.courseCode}
                onChange={e => updateCourse(i, 'courseCode', e.target.value)}
                onSelect={course => selectCourse(i, course)}
              />
              <Input
                placeholder="Tên môn"
                value={c.courseName}
                onChange={e => updateCourse(i, 'courseName', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Điểm"
                value={c.grade}
                onChange={e => updateCourse(i, 'grade', e.target.value)}
                className="w-24"
              />
              {courses.length > 1 && (
                <button onClick={() => removeCourse(i)} className="text-[#444] hover:text-red-400 transition-colors text-lg leading-none">×</button>
              )}
            </div>
          ))}
        </div>
        {errors.courses && <p className="text-red-400 text-xs mt-3">{errors.courses}</p>}
        <Button onClick={handleIssue} disabled={loading} className="w-full mt-5">
          {loading ? 'Đang ký bằng MetaMask...' : '🔐 Ký & Tạo Credential JSON'}
        </Button>
      </Card>

      {result && (
        <div ref={resultRef}>
          <Card glow>
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="green">Đã ký thành công</Badge>
              <span className="text-sm text-white">Credential sẵn sàng giao cho sinh viên</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-[#0f0f0f] rounded-xl border border-[#1a1a1a]">
              <InfoRow label="Sinh viên" value={result.studentName || '—'} />
              <InfoRow label="Mã SV" value={result.studentId} />
              <InfoRow label="Trường" value={result.universityName} />
              <InfoRow label="Ngày cấp" value={new Date(result.issuedAt).toLocaleString('vi-VN')} />
            </div>

            <div className="space-y-2 mb-4">
              <CopyField label="Credential ID" value={result.credentialId} truncate={false} />
              <CopyField label="Merkle Root" value={result.merkleRoot} />
              <CopyField label="Credential Hash (đã ký)" value={result.credentialHash} />
              <CopyField label="Chữ ký Issuer (ECC / MetaMask)" value={result.issuerSignature} />
            </div>

            <div className="mt-4 pt-4 border-t border-[#1a1a1a] flex gap-3">
              <Button onClick={handleDownload} className="flex-1">
                ⬇ Tải credential.json
              </Button>
              <button
                onClick={handleClear}
                className="text-xs text-[#555] hover:text-red-400 border border-[#222] hover:border-red-500/30 px-4 rounded-xl transition-colors"
              >
                Phát hành mới
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Revoke ─────────────────────────────────────────────────────────────
function RevokeTab({ wallet, authorized }) {
  const toast = useToast()
  const [credHash, setCredHash] = useState(() => {
    // Pre-fill from last issued credential
    try {
      const saved = localStorage.getItem('credproof_last_credential')
      return saved ? JSON.parse(saved).credentialHash || '' : ''
    } catch { return '' }
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handle = async () => {
    if (!credHash.trim()) return toast.error('Nhập Credential Hash')
    if (!/^0x[0-9a-fA-F]{64}$/.test(credHash)) return toast.error('Credential Hash phải là bytes32 hex (0x + 64 ký tự)')
    setLoading(true)
    try {
      toast.info('MetaMask sẽ hiện popup để xác nhận giao dịch thu hồi...')
      const receipt = await revokeCredential(wallet.signer, credHash)
      setResult({ credHash, txHash: receipt.hash })
      toast.success('Credential đã bị thu hồi on-chain!')
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setLoading(false)
    }
  }

  if (!wallet) {
    return <Card><p className="text-yellow-400 text-sm">⚠ Kết nối ví Issuer trước.</p></Card>
  }

  if (!authorized) {
    return (
      <Card>
        <p className="text-yellow-400 text-sm font-semibold mb-1">⚠ Ví này chưa được Admin ủy quyền làm Issuer.</p>
        <p className="text-[#555] text-xs">Chỉ Authorized Issuer mới có thể thu hồi văn bằng trên blockchain.</p>
      </Card>
    )
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-white mb-2">Thu hồi văn bằng</h2>
        <p className="text-xs text-[#555] mb-5 leading-relaxed">
          Nhập <span className="text-white">credentialHash</span> từ file credential.json đã cấp.
          Giao dịch này sẽ ghi vĩnh viễn lên blockchain.
        </p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#888]">Credential Hash (bytes32)</label>
            <span className="text-xs text-[#555] font-mono">{short(wallet.address)}</span>
          </div>
          <Input
            placeholder="0x... (lấy từ credential.json → trường credentialHash)"
            value={credHash}
            onChange={e => setCredHash(e.target.value)}
          />
        </div>
        <Button variant="danger" onClick={handle} disabled={loading} className="w-full mt-4">
          {loading ? 'Đang gửi giao dịch...' : 'Thu hồi văn bằng on-chain'}
        </Button>
      </Card>

      {result && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="red">Đã thu hồi</Badge>
            <span className="text-sm text-white">Ghi nhận trên blockchain</span>
          </div>
          <CopyField label="Credential Hash" value={result.credHash} truncate={false} />
          <CopyField label="Tx Hash" value={result.txHash} />
        </Card>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[#555] text-xs">{label}</span>
      <span className="text-[#aaa] text-sm break-all">{value}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function IssuerDashboard() {
  const { wallet } = useWallet()
  const [tab, setTab] = useState('connect')
  const [authorized, setAuthorized] = useState(false)

  // Re-check authorized whenever wallet changes (e.g. user switches account)
  useEffect(() => {
    if (!wallet) { setAuthorized(false); return }
    isAuthorizedIssuer(wallet.provider, wallet.address)
      .then(setAuthorized)
      .catch(() => setAuthorized(false))
  }, [wallet?.address, wallet?.chainId])

  const activeStep = tab === 'connect' ? 0 : tab === 'issue' ? 1 : 2
  const completedSteps = [wallet ? 0 : null].filter(s => s !== null)

  return (
    <DashboardLayout
      title="Tổ chức cấp bằng"
      subtitle="Ký và phát hành văn bằng học thuật số bằng MetaMask"
    >
      <WorkflowStepper steps={WORKFLOW} activeStep={activeStep} completedSteps={completedSteps} />

      <div className="flex items-center gap-1 border border-[#1d1d1d] bg-[#0d0d0d] rounded-full p-1 w-fit mb-8">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              tab === t.id ? 'bg-[#1d1d1d] text-white' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {t.label}
            {t.id === 'connect' && wallet && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          </button>
        ))}
      </div>

      {tab === 'connect' && (
        <ConnectTab
          wallet={wallet}
          authorized={authorized}
          onConnected={auth => { setAuthorized(auth); if (auth) setTab('issue') }}
        />
      )}
      {tab === 'issue'  && <IssueTab wallet={wallet} authorized={authorized} />}
      {tab === 'revoke' && <RevokeTab wallet={wallet} authorized={authorized} />}
    </DashboardLayout>
  )
}
