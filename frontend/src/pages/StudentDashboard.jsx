import { useState, useRef } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import CopyField from '../components/CopyField'
import { useToast } from '../components/Toast'
import { walletError, getReadProvider } from '../services/wallet'
import { useWallet } from '../contexts/WalletContext'
import ConnectButton from '../components/ConnectButton'
import { isAuthorizedIssuer, isRevoked, CONTRACT_ADDRESS } from '../services/contract'
import {
  validateCredentialSchema, validateCredentialOffChain,
  buildProofJSON,
} from '../services/credential'
import { downloadJSON } from '../utils/download'

const TABS = [
  { id: 'upload', label: 'Upload & Xác nhận' },
  { id: 'proof',  label: 'Tạo Proof' },
]

function CheckRow({ label, desc, ok, skip }) {
  const color = skip ? 'text-[#555]' : ok ? 'text-green-400' : 'text-red-400'
  const icon  = skip ? '—' : ok ? '✓' : '✗'
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#1a1a1a] last:border-0">
      <span className={`text-sm mt-0.5 ${color}`}>{icon}</span>
      <div className="flex-1">
        <p className="text-sm text-white">{label}</p>
        {desc && <p className="text-xs text-[#555]">{desc}</p>}
      </div>
      {!skip && <Badge variant={ok ? 'green' : 'red'}>{ok ? 'Pass' : 'Fail'}</Badge>}
    </div>
  )
}

function short(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '' }

export default function StudentDashboard() {
  const toast = useToast()
  const fileRef = useRef(null)
  const { wallet } = useWallet()

  const [tab, setTab] = useState('upload')
  const [credential, setCredential] = useState(null)
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)

  // Proof tab
  const [selectedCourses, setSelectedCourses] = useState([])
  const [proofResult, setProofResult] = useState(null)

  // ── Wallet ───────────────────────────────────────────────────────────────
  const handleConnected = (w) => {
    toast.success(`Kết nối ví: ${short(w.address)}`)
  }

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      setCredential(json)
      setValidation(null)
      setProofResult(null)
      setSelectedCourses([])
      toast.info('Đã tải credential JSON. Nhấn "Xác nhận" để kiểm tra.')
    } catch {
      toast.error('File không hợp lệ. Hãy upload đúng credential JSON.')
    }
    // Reset file input so same file can be re-uploaded after delete
    e.target.value = ''
  }

  const handleDelete = () => {
    setCredential(null)
    setValidation(null)
    setProofResult(null)
    setSelectedCourses([])
    toast.info('Đã xóa credential. Upload file mới.')
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!credential) return toast.error('Chưa upload credential')
    if (!wallet)     return toast.error('Kết nối ví MetaMask trước')

    setValidating(true)
    try {
      // Off-chain checks
      const offChain = validateCredentialOffChain(credential, wallet.address)

      // On-chain checks
      const provider = wallet.provider || await getReadProvider()
      const [issuerAuthorized, credRevoked] = await Promise.all([
        isAuthorizedIssuer(provider, credential.issuerWallet).catch(() => false),
        isRevoked(provider, credential.credentialHash).catch(() => false),
      ])

      const v = {
        ...offChain,
        issuerAuthorized,
        notRevoked: !credRevoked,
        valid: offChain.schema
          && offChain.walletMatch
          && offChain.hashConsistent
          && offChain.signatureValid
          && offChain.merkleRootConsistent
          && issuerAuthorized
          && !credRevoked,
      }
      setValidation(v)
      if (v.valid) {
        toast.success('Credential hợp lệ! Có thể tạo proof.')
      } else {
        toast.error('Credential không hợp lệ. Xem chi tiết bên dưới.')
      }
    } catch (e) {
      toast.error(walletError(e))
    } finally {
      setValidating(false)
    }
  }

  // ── Proof ─────────────────────────────────────────────────────────────────
  const toggleCourse = (code) => {
    setSelectedCourses(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
    setProofResult(null)
  }

  const handleGenerateProof = () => {
    if (selectedCourses.length === 0) return toast.error('Chọn ít nhất 1 môn học')
    const proof = buildProofJSON(credential, selectedCourses)
    setProofResult(proof)
    toast.success(`Proof cho ${selectedCourses.length} môn đã được tạo!`)
  }

  const handleDownloadProof = () => {
    if (!proofResult) return
    downloadJSON(proofResult, `proof-${credential.studentId}-${Date.now()}.json`)
    toast.success('Đã tải xuống proof JSON')
  }

  const isValidated = validation?.valid === true

  return (
    <DashboardLayout title="Sinh viên" subtitle="Xác nhận văn bằng và tạo proof chọn lọc để chia sẻ">
      <div className="flex items-center gap-1 border border-[#1d1d1d] bg-[#0d0d0d] rounded-full p-1 w-fit mb-8">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              tab === t.id ? 'bg-[#1d1d1d] text-white' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {t.label}
            {t.id === 'upload' && isValidated && <span className="ml-2 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
          </button>
        ))}
      </div>

      {/* ── Tab: Upload & Validate ── */}
      {tab === 'upload' && (
        <div className="max-w-xl space-y-4">
          {/* Connect wallet */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Ví sinh viên</h2>
              {wallet && <Badge variant="green">{short(wallet.address)}</Badge>}
            </div>
            {!wallet && <ConnectButton onConnected={handleConnected} className="mb-3" />}
            <p className="text-xs text-[#555]">
              Ví của bạn phải khớp với địa chỉ <span className="text-white">studentWallet</span> trong credential để xác nhận quyền sở hữu.
            </p>
          </Card>

          {/* File upload */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Upload Credential JSON</h2>
              {credential && (
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  🗑 Xóa file
                </button>
              )}
            </div>

            {!credential ? (
              <div>
                <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#333] hover:border-[#6c47ff] rounded-xl py-8 text-center transition-colors"
                >
                  <p className="text-[#555] text-sm">Click để chọn file credential.json</p>
                  <p className="text-[#444] text-xs mt-1">Nhận từ trường đại học sau khi tốt nghiệp</p>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
                  <span className="text-green-400 text-sm">✓</span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{credential.universityName || 'Credential'}</p>
                    <p className="text-xs text-[#555]">{credential.studentName} — {credential.studentId}</p>
                  </div>
                  <Badge variant="purple">{credential.courses?.length || 0} môn</Badge>
                </div>
                <Button onClick={handleValidate} disabled={validating || !wallet} className="w-full">
                  {validating ? 'Đang xác nhận...' : 'Xác nhận văn bằng (on-chain + ECC + Merkle)'}
                </Button>
                {!wallet && <p className="text-yellow-500 text-xs text-center">Kết nối MetaMask trước khi xác nhận</p>}
              </div>
            )}
          </Card>

          {/* Validation results */}
          {validation && (
            <Card glow={validation.valid}>
              <div className={`rounded-xl p-4 mb-5 border ${validation.valid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="text-2xl mb-1">{validation.valid ? '✅' : '❌'}</div>
                <p className={`text-base font-bold ${validation.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {validation.valid ? 'Văn bằng hợp lệ' : 'Văn bằng không hợp lệ'}
                </p>
                {validation.error && <p className="text-xs text-red-400 mt-1">{validation.error}</p>}
              </div>
              <p className="text-xs text-[#444] font-medium uppercase tracking-widest mb-3">Chi tiết kiểm tra</p>
              <CheckRow label="Schema JSON đúng" ok={validation.schema} />
              <CheckRow label="Ví sinh viên khớp" desc={`JSON: ${short(credential?.studentWallet)}  |  Ví connect: ${short(wallet?.address)}`} ok={validation.walletMatch} />
              <CheckRow label="Issuer được ủy quyền on-chain" desc="Kiểm tra registry contract" ok={validation.issuerAuthorized} />
              <CheckRow label="Chữ ký ECC (MetaMask) hợp lệ" desc="Issuer đã ký credentialHash bằng ví của mình" ok={validation.signatureValid} />
              <CheckRow label="Credential chưa bị thu hồi" desc="Kiểm tra revokedCredentials on-chain" ok={validation.notRevoked} />
              <CheckRow label="Merkle Root nhất quán" desc="Tính lại từ bảng điểm, so sánh với JSON" ok={validation.merkleRootConsistent} />
              <CheckRow label="Credential Hash nhất quán" desc="Tính lại từ các trường, so sánh với JSON" ok={validation.hashConsistent} />

              {validation.valid && (
                <div className="mt-4 pt-4 border-t border-[#1d1d1d]">
                  <button
                    onClick={() => setTab('proof')}
                    className="text-sm text-[#6c47ff] hover:text-white transition-colors font-medium"
                  >
                    → Chuyển sang "Tạo Proof"
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: Tạo Proof ── */}
      {tab === 'proof' && (
        <div className="max-w-xl space-y-4">
          {!credential || !isValidated ? (
            <Card>
              <p className="text-yellow-400 text-sm">
                ⚠ Cần upload và xác nhận credential thành công ở tab trước.
              </p>
            </Card>
          ) : (
            <>
              <Card>
                <h2 className="text-base font-semibold text-white mb-1">Chọn môn cần tiết lộ</h2>
                <p className="text-xs text-[#555] mb-4">
                  Verifier chỉ thấy các môn được chọn — các môn còn lại vẫn ẩn hoàn toàn.
                </p>
                <div className="space-y-2">
                  {credential.courses.map((c) => (
                    <label
                      key={c.courseCode}
                      className="flex items-center gap-3 px-3 py-2.5 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl cursor-pointer hover:border-[#6c47ff]/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourses.includes(c.courseCode)}
                        onChange={() => toggleCourse(c.courseCode)}
                        className="accent-[#6c47ff] w-4 h-4"
                      />
                      <span className="text-xs font-mono text-[#888] w-20 shrink-0">{c.courseCode}</span>
                      <span className="text-xs text-[#555] flex-1 truncate">{c.courseName}</span>
                      <Badge variant="purple">{c.grade}</Badge>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-[#555] mt-3">Đã chọn: <span className="text-white">{selectedCourses.length}</span> / {credential.courses.length} môn</p>

                <Button
                  onClick={handleGenerateProof}
                  disabled={selectedCourses.length === 0}
                  className="w-full mt-4"
                >
                  Tạo Merkle Proof
                </Button>
              </Card>

              {proofResult && (
                <Card glow>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="purple">Proof đã tạo</Badge>
                    <span className="text-sm text-white">{proofResult.selectedCourses.length} môn được tiết lộ</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <CopyField label="Credential ID" value={proofResult.credentialId} />
                    <CopyField label="Merkle Root" value={proofResult.merkleRoot} />
                  </div>

                  <div className="space-y-2 mb-4">
                    {proofResult.selectedCourses.map((sc, i) => (
                      <div key={i} className="p-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-white">{sc.courseCode}</span>
                          <Badge variant="purple">{sc.grade}</Badge>
                        </div>
                        <p className="text-xs text-[#555]">Proof nodes: {sc.merkleProof.length}</p>
                        <p className="text-xs text-[#444] font-mono truncate mt-1">leaf: {sc.leafHash}</p>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleDownloadProof} className="w-full">
                    ⬇ Tải proof.json (gửi cho Verifier)
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
