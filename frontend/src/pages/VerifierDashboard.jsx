import { useState, useRef } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import CopyField from '../components/CopyField'
import { useToast } from '../components/Toast'
import { getReadProvider } from '../services/wallet'
import { isAuthorizedIssuer, isRevoked } from '../services/contract'
import { validateProofOffChain } from '../services/credential'

function CheckRow({ label, desc, ok }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#1a1a1a] last:border-0">
      <span className={`text-sm mt-0.5 ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? '✓' : '✗'}</span>
      <div className="flex-1">
        <p className="text-sm text-white">{label}</p>
        {desc && <p className="text-xs text-[#555]">{desc}</p>}
      </div>
      <Badge variant={ok ? 'green' : 'red'}>{ok ? 'Pass' : 'Fail'}</Badge>
    </div>
  )
}

function short(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '' }

export default function VerifierDashboard() {
  const toast = useToast()
  const fileRef = useRef(null)

  const [proof, setProof] = useState(null)
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      setProof(json)
      setResult(null)
      toast.info('Đã tải proof JSON. Nhấn "Xác minh" để kiểm tra.')
    } catch {
      toast.error('File không hợp lệ. Hãy upload đúng proof JSON.')
    }
    e.target.value = ''
  }

  const handleVerify = async () => {
    if (!proof) return toast.error('Chưa upload proof')
    setVerifying(true)
    try {
      // Off-chain: schema + ECC signature + merkle proofs
      const offChain = validateProofOffChain(proof)

      // On-chain: issuer authorized + not revoked
      const provider = await getReadProvider()
      const [issuerAuthorized, credRevoked] = await Promise.all([
        isAuthorizedIssuer(provider, proof.issuerWallet).catch(() => false),
        isRevoked(provider, proof.credentialHash).catch(() => false),
      ])

      const notRevoked = !credRevoked

      const valid = offChain.schema
        && offChain.signatureValid
        && offChain.allCoursesValid
        && issuerAuthorized
        && notRevoked

      setResult({
        valid,
        schema: offChain.schema,
        signatureValid: offChain.signatureValid,
        issuerAuthorized,
        notRevoked,
        allCoursesValid: offChain.allCoursesValid,
        courses: offChain.courses || [],
        error: offChain.error,
      })

      if (valid) toast.success('Proof hợp lệ! Văn bằng được xác nhận.')
      else toast.error('Proof không hợp lệ. Xem chi tiết bên dưới.')
    } catch (e) {
      toast.error(e?.message || 'Lỗi không xác định')
    } finally {
      setVerifying(false)
    }
  }

  const isValid = result?.valid === true

  return (
    <DashboardLayout title="Xác minh văn bằng" subtitle="Upload proof JSON để kiểm tra tính hợp lệ — không cần kết nối ví">
      <div className="max-w-2xl space-y-5">
        {/* Info */}
        <div className="flex items-start gap-2 bg-[#0f1520] border border-[#1a2a3a] rounded-xl px-4 py-3 text-xs text-[#888]">
          <span className="text-blue-400 shrink-0 mt-0.5">ℹ</span>
          <span>
            Verifier không cần kết nối ví. Hệ thống dùng RPC localhost:8545 để đọc on-chain.
            Đảm bảo Hardhat node đang chạy.
          </span>
        </div>

        {/* Upload */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Upload Proof JSON</h2>
            {proof && (
              <button
                onClick={() => { setProof(null); setResult(null) }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                🗑 Xóa
              </button>
            )}
          </div>
          <p className="text-xs text-[#666] mb-4">
            Sinh viên export từ trang "Sinh viên → Tạo Proof". Proof chỉ chứa các môn được chọn, không có toàn bộ bảng điểm.
          </p>

          {!proof ? (
            <div>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-[#333] hover:border-[#6c47ff] rounded-xl py-8 text-center transition-colors"
              >
                <p className="text-[#555] text-sm">Click để chọn file proof.json</p>
                <p className="text-[#444] text-xs mt-1">Nhận từ sinh viên/ứng viên</p>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl space-y-1">
                <p className="text-sm text-white font-mono truncate">Credential: {short(proof.credentialId)}</p>
                <p className="text-xs text-[#555]">
                  {proof.selectedCourses?.length || 0} môn được tiết lộ
                </p>
                <p className="text-xs font-mono text-[#444] truncate">Issuer: {short(proof.issuerWallet)}</p>
              </div>
              <Button onClick={handleVerify} disabled={verifying} className="w-full">
                {verifying ? 'Đang xác minh...' : 'Xác minh (on-chain + ECC + Merkle)'}
              </Button>
            </div>
          )}
        </Card>

        {/* Result */}
        {result && (
          <Card glow={isValid}>
            {/* Verdict */}
            <div className={`rounded-xl p-5 mb-5 border ${isValid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="text-3xl mb-2">{isValid ? '✅' : '❌'}</div>
              <div className={`text-lg font-bold ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                {isValid ? 'Proof hợp lệ — Văn bằng được xác nhận' : 'Proof không hợp lệ'}
              </div>
              {result.error && <p className="text-xs text-red-400 mt-1">{result.error}</p>}
            </div>

            {/* Check breakdown */}
            <p className="text-xs text-[#444] font-medium uppercase tracking-widest mb-3">Chi tiết kiểm tra</p>
            <CheckRow label="Schema JSON đúng" ok={result.schema} />
            <CheckRow
              label="Issuer được ủy quyền on-chain"
              desc={`Contract registry: ${short(proof?.issuerWallet)}`}
              ok={result.issuerAuthorized}
            />
            <CheckRow
              label="Credential chưa bị thu hồi"
              desc="Kiểm tra revokedCredentials on-chain"
              ok={result.notRevoked}
            />
            <CheckRow
              label="Chữ ký Issuer hợp lệ (ECC / MetaMask)"
              desc="ethers.verifyMessage — khôi phục địa chỉ issuer từ signature"
              ok={result.signatureValid}
            />
            <CheckRow
              label="Tất cả Merkle Proof hợp lệ"
              desc={`${result.courses.length} môn được kiểm tra`}
              ok={result.allCoursesValid}
            />

            {/* Per-course detail */}
            {result.courses.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-[#444] font-medium uppercase tracking-widest">Môn học được tiết lộ</p>
                {result.courses.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
                    <span className={`text-sm ${c.valid ? 'text-green-400' : 'text-red-400'}`}>{c.valid ? '✓' : '✗'}</span>
                    <span className="text-xs font-mono text-[#888] w-20 shrink-0">{c.courseCode}</span>
                    <span className="text-xs text-white flex-1 truncate">{c.courseName}</span>
                    <span className="text-xs text-[#555] shrink-0">
                      {c.leafMatch ? '' : 'leaf mismatch '}{c.proofValid ? '' : 'proof invalid'}
                      {c.valid ? 'Hợp lệ' : ''}
                    </span>
                    <Badge variant={c.valid ? 'green' : 'red'}>{c.grade}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Proof metadata */}
            {proof && (
              <div className="mt-4 pt-4 border-t border-[#1d1d1d] space-y-2">
                <CopyField label="Credential ID" value={proof.credentialId} />
                <CopyField label="Issuer Wallet" value={proof.issuerWallet} />
                <CopyField label="Merkle Root" value={proof.merkleRoot} />
              </div>
            )}
          </Card>
        )}

        {/* Explanation */}
        <div className="border border-[#1d1d1d] bg-[#0d0d0d] rounded-xl p-5">
          <p className="text-xs text-[#555] font-medium uppercase tracking-widest mb-3">Cách hoạt động</p>
          <ul className="space-y-2 text-xs text-[#555]">
            <li>→ <span className="text-[#888]">On-chain registry</span>: xác nhận issuer có quyền cấp bằng</li>
            <li>→ <span className="text-[#888]">ECC signature</span>: xác nhận đúng issuer đã ký credential này</li>
            <li>→ <span className="text-[#888]">Merkle Proof</span>: chứng minh môn học nằm trong bảng điểm mà không lộ toàn bộ</li>
            <li>→ <span className="text-[#888]">Revocation check</span>: đảm bảo credential chưa bị thu hồi</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  )
}
