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
import { useIssuer } from '../context/IssuerContext'
import { useToast } from '../components/Toast'
import { registerIssuer, issueCredential, revokeCredential } from '../services/api'

function friendlyError(e) {
  const msg = e.response?.data?.error || e.message || 'Lỗi không xác định'
  if (msg.includes('already registered')) return 'Tổ chức này đã được đăng ký rồi.'
  if (msg.includes('Issuer not found')) return 'Issuer chưa đăng ký. Vào tab Đăng ký trước.'
  if (msg.includes('not found') || msg.includes('Not found')) return 'Không tìm thấy. Kiểm tra lại ID.'
  if (msg.includes('Already revoked')) return 'Credential này đã bị thu hồi trước đó rồi.'
  if (msg.includes('ETIMEDOUT') || msg.includes('Network Error')) return 'Không kết nối được server. Kiểm tra backend đang chạy chưa (node backend/server.js).'
  if (msg.includes('not in credential')) return 'Mã môn học không tồn tại trong credential này.'
  if (msg.includes('already has an active credential') || msg.includes('Already issued')) return 'Sinh viên này hiện đã có văn bằng đang hiệu lực từ tổ chức này. Hãy thu hồi văn bằng cũ trước khi cấp lại.'
  if (msg.includes('Not authorized issuer') || msg.includes('Not authorized')) return 'Địa chỉ ví này chưa được cấp quyền issuer. Kiểm tra lại ethAddress trong bước Đăng ký.'
  return msg
}

function validate(rules) {
  const errors = {}
  for (const [field, checks] of Object.entries(rules)) {
    for (const { test, msg } of checks) {
      if (!test) { errors[field] = msg; break }
    }
  }
  return errors
}

// ─── Tab: Đăng ký tổ chức ─────────────────────────────────────────────────
function RegisterTab({ onRegistered }) {
  const { issuer, saveIssuer, clearIssuer } = useIssuer()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', ethAddress: '', ethPrivateKey: '' })
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const fillHardhat = () => {
    setForm(f => ({
      ...f,
      ethAddress:    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      ethPrivateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    }))
    setErrors({})
    toast.info('Đã điền thông tin tài khoản Hardhat test #1')
  }

  const handle = async () => {
    const errs = validate({
      name:          [{ test: !!form.name.trim(), msg: 'Vui lòng nhập tên tổ chức' }],
      ethAddress:    [
        { test: !!form.ethAddress.trim(), msg: 'Vui lòng nhập địa chỉ Ethereum' },
        { test: /^0x[0-9a-fA-F]{40}$/.test(form.ethAddress), msg: 'Địa chỉ không hợp lệ (0x + 40 ký tự hex)' },
      ],
      ethPrivateKey: [{ test: !!form.ethPrivateKey.trim(), msg: 'Vui lòng nhập private key' }],
    })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await registerIssuer(form)
      setResult(res.data)
      saveIssuer({
        ethAddress:    res.data.issuer.ethAddress,
        eccPrivateKey: res.data.issuer.eccPrivateKey,
        eccPublicKey:  res.data.issuer.eccPublicKey,
        name:          res.data.issuer.name,
      })
      toast.success(`Đã đăng ký tổ chức "${res.data.issuer.name}" thành công!`)
      onRegistered?.()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  // Already registered — show summary banner
  if (issuer && !result) {
    return (
      <div className="max-w-xl space-y-4">
        <Card glow>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="green">Đã đăng ký</Badge>
              <span className="text-sm text-white font-medium">{issuer.name}</span>
            </div>
            <button
              onClick={clearIssuer}
              className="text-xs text-[#555] hover:text-red-400 transition-colors"
            >
              Xóa &amp; đăng ký lại
            </button>
          </div>
          <div className="space-y-3">
            <CopyField label="Ethereum Address" value={issuer.ethAddress} />
            <CopyField label="ECC Public Key" value={issuer.eccPublicKey} />
          </div>
          <p className="text-xs text-[#6c47ff] mt-4">
            ✓ Thông tin đã tự động điền sang tab "Phát hành văn bằng"
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Thông tin tổ chức</h2>
          <Button variant="secondary" size="sm" onClick={fillHardhat}>
            ⚡ Dùng tài khoản test (Hardhat #1)
          </Button>
        </div>
        <div className="flex items-start gap-2 bg-[#0f1520] border border-[#1a2a3a] rounded-xl px-4 py-3 mb-4">
          <span className="text-blue-400 text-sm shrink-0 mt-0.5">ℹ</span>
          <p className="text-xs text-[#888] leading-relaxed">
            Mỗi tổ chức tương ứng với <span className="text-white">một địa chỉ ví Ethereum riêng</span>.
            Ví này sẽ ký giao dịch phát hành/thu hồi văn bằng trên blockchain.
            Khi test local, dùng một trong các tài khoản Hardhat (không dùng Account #0 vì đó là ví admin).
          </p>
        </div>
        <div className="space-y-4">
          <Input
            label="Tên trường / tổ chức"
            placeholder="VD: Đại học Bách khoa Hà Nội"
            value={form.name}
            error={errors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-sm font-medium text-[#888]">Địa chỉ Ethereum (Issuer wallet)</label>
              <Tooltip text="Địa chỉ ví Ethereum của tổ chức. Dùng để định danh on-chain." />
            </div>
            <Input
              placeholder="0x70997970..."
              value={form.ethAddress}
              error={errors.ethAddress}
              onChange={(e) => setForm({ ...form, ethAddress: e.target.value })}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-sm font-medium text-[#888]">Private key Ethereum (Issuer wallet)</label>
              <Tooltip text="Private key dùng để ký giao dịch blockchain. Chỉ nhập khi test local." />
            </div>
            <Input
              placeholder="0x59c6995e..."
              type="password"
              value={form.ethPrivateKey}
              error={errors.ethPrivateKey}
              onChange={(e) => setForm({ ...form, ethPrivateKey: e.target.value })}
            />
          </div>
          <Button onClick={handle} disabled={loading} className="w-full">
            {loading ? 'Đang xử lý...' : 'Đăng ký tổ chức'}
          </Button>
        </div>
      </Card>

      {result && (
        <Card glow>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="green">Thành công</Badge>
            <span className="text-sm text-white font-medium">Tổ chức đã được đăng ký</span>
          </div>
          <div className="space-y-3">
            <Row label="Tên" value={result.issuer.name} />
            <CopyField label="Ethereum Address" value={result.issuer.ethAddress} />
            <CopyField label="ECC Public Key" value={result.issuer.eccPublicKey} />
            <div className="border border-[#6c47ff]/20 bg-[#6c47ff]/5 rounded-xl p-3">
              <p className="text-[#6c47ff] font-medium mb-1 text-sm">⚠️ Lưu ECC Private Key ngay</p>
              <p className="text-[#888] mb-2 text-xs">Chỉ hiển thị một lần. Dùng để phát hành văn bằng.</p>
              <CopyField label="ECC Private Key (lưu lại!)" value={result.issuer.eccPrivateKey} truncate={false} />
            </div>
            <p className="text-xs text-[#6c47ff] mt-2">
              ✓ Thông tin đã tự động điền sang tab "Phát hành văn bằng"
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Tab: Phát hành văn bằng ──────────────────────────────────────────────
function IssueTab({ onIssued, onGoToRevoke }) {
  const { issuer } = useIssuer()
  const toast = useToast()

  const [form, setForm] = useState({
    issuerAddress: issuer?.ethAddress || '',
    studentId:     '',
    studentName:   '',
  })
  const [courses, setCourses] = useState([{ courseCode: '', courseName: '', grade: '' }])
  const [result, setResult]   = useState(null)
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const resultRef = useRef(null)

  // Scroll to result card after issuing
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [result])

  const addCourse    = () => setCourses([...courses, { courseCode: '', courseName: '', grade: '' }])
  const removeCourse = (i) => setCourses(courses.filter((_, idx) => idx !== i))
  const updateCourse = (i, field, val) => {
    const next = [...courses]; next[i][field] = val; setCourses(next)
  }
  const selectCourse = (i, course) => {
    const next = [...courses]
    next[i] = { courseCode: course.courseCode, courseName: course.courseName, grade: course.grade }
    setCourses(next)
  }

  const handle = async () => {
    const filled = courses.filter(c => c.courseCode && c.grade)
    const errs = validate({
      issuerAddress: [{ test: !!form.issuerAddress.trim(), msg: 'Thiếu địa chỉ issuer' }],
      studentId:     [{ test: !!form.studentId.trim(),     msg: 'Nhập mã sinh viên' }],
      courses:       [{ test: filled.length > 0,           msg: 'Cần ít nhất 1 môn học có mã và điểm' }],
    })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await issueCredential({ ...form, courses: filled })
      setResult(res.data)
      // Persist credentialId so RevokeTab can auto-fill
      if (res.data.credentialId) {
        localStorage.setItem('lastCredentialId', res.data.credentialId)
      }
      toast.success('Văn bằng đã được phát hành lên blockchain!')
      onIssued?.(res.data.credentialId)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  const isLocked = !!issuer

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Thông tin phát hành</h2>
          {isLocked && <Badge variant="green">Tự động điền từ đăng ký</Badge>}
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-sm font-medium text-[#888]">Địa chỉ tổ chức (Issuer)</label>
              {isLocked && <Tooltip text="Tự động điền từ bước đăng ký tổ chức" />}
            </div>
            <Input
              placeholder="0x70997970..."
              value={form.issuerAddress}
              error={errors.issuerAddress}
              readOnly={isLocked}
              className={isLocked ? 'opacity-60 cursor-not-allowed' : ''}
              onChange={(e) => !isLocked && setForm({ ...form, issuerAddress: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Mã sinh viên"
              placeholder="SV-2021-001"
              value={form.studentId}
              error={errors.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            />
            <Input
              label="Họ tên sinh viên"
              placeholder="Nguyễn Văn A"
              value={form.studentName}
              onChange={(e) => setForm({ ...form, studentName: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Bảng điểm</h2>
            <p className="text-xs text-[#555] mt-0.5">Gõ mã môn hoặc tên môn để tìm nhanh</p>
          </div>
          <Button variant="ghost" size="sm" onClick={addCourse}>+ Thêm môn</Button>
        </div>
        <div className="space-y-3">
          {courses.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <CourseInput
                value={c.courseCode}
                onChange={(e) => updateCourse(i, 'courseCode', e.target.value)}
                onSelect={(course) => selectCourse(i, course)}
              />
              <Input
                placeholder="Tên môn"
                value={c.courseName}
                onChange={(e) => updateCourse(i, 'courseName', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Điểm"
                value={c.grade}
                onChange={(e) => updateCourse(i, 'grade', e.target.value)}
                className="w-24"
              />
              {courses.length > 1 && (
                <button
                  onClick={() => removeCourse(i)}
                  className="text-[#444] hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {errors.courses && <p className="text-red-400 text-xs mt-3">{errors.courses}</p>}
        <Button onClick={handle} disabled={loading} className="w-full mt-5">
          {loading ? 'Đang phát hành...' : 'Phát hành văn bằng'}
        </Button>
      </Card>

      {result && (
        <div ref={resultRef}>
          <Card glow>
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="green">Đã phát hành</Badge>
              <span className="text-sm text-white font-medium">Văn bằng lên blockchain thành công</span>
            </div>

            {/* Student info */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-[#0f0f0f] rounded-xl border border-[#1a1a1a]">
              <Row label="Mã sinh viên" value={result.payload?.studentId || form.studentId} />
              <Row label="Họ tên sinh viên" value={result.payload?.studentName || form.studentName || '—'} />
            </div>

            {/* Credential ID — primary field */}
            <div className="mb-4">
              <p className="text-xs text-[#6c47ff] mb-1.5 font-medium">
                Credential ID — dùng để xem bằng, tạo proof, và thu hồi
              </p>
              <CopyField value={result.credentialId} truncate={false} />
            </div>

            <div className="space-y-2">
              <CopyField label="Merkle Root" value={result.merkleRoot} />
              <CopyField label="Chữ ký ECC (r)" value={result.signature?.r} />
              <CopyField label="Chữ ký ECC (s)" value={result.signature?.s} />
            </div>

            {/* Course list */}
            {result.payload?.courses?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-[#555] mb-2 uppercase tracking-wider">
                  Môn học đã cấp ({result.payload.courses.length} môn)
                </p>
                <div className="space-y-1">
                  {result.payload.courses.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[#0f0f0f] rounded-lg border border-[#1a1a1a]">
                      <span className="text-xs font-mono text-[#888] w-20 shrink-0">{c.courseCode}</span>
                      <span className="text-xs text-[#555] flex-1 truncate">{c.courseName}</span>
                      <span className="text-xs font-bold text-[#6c47ff] shrink-0">{c.grade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="mt-5 pt-4 border-t border-[#1a1a1a] flex items-center justify-between">
              <p className="text-xs text-[#555]">Credential ID đã lưu tự động cho tab Thu hồi</p>
              <button
                onClick={onGoToRevoke}
                className="text-xs text-[#6c47ff] hover:text-white transition-colors font-medium"
              >
                Sang tab Thu hồi →
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Thu hồi văn bằng ────────────────────────────────────────────────
function RevokeTab({ lastCredentialId }) {
  const toast = useToast()
  // Auto-fill from prop (just issued) or localStorage (previous session)
  const [credentialId, setCredentialId] = useState(
    lastCredentialId || localStorage.getItem('lastCredentialId') || ''
  )
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  const autoFilled = !!(lastCredentialId || localStorage.getItem('lastCredentialId'))

  const handle = async () => {
    if (!credentialId.trim()) { toast.error('Nhập Credential ID'); return }
    setLoading(true)
    try {
      const res = await revokeCredential(credentialId)
      setResult(res.data)
      toast.success('Credential đã bị thu hồi thành công')
      localStorage.removeItem('lastCredentialId')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-white mb-2">Thu hồi văn bằng</h2>
        <p className="text-xs text-[#555] mb-5 leading-relaxed">
          Credential ID là mã văn bằng được tạo sau khi phát hành.
          Bạn có thể copy từ kết quả phát hành ở tab trước.
        </p>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#888]">Credential ID</label>
            {autoFilled && !result && (
              <span className="text-xs text-[#6c47ff]">✓ Tự động điền từ lần phát hành vừa rồi</span>
            )}
          </div>
          <Input
            placeholder="0x..."
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
          />
        </div>

        <Button variant="danger" onClick={handle} disabled={loading} className="w-full mt-4">
          {loading ? 'Đang xử lý...' : 'Thu hồi văn bằng'}
        </Button>
      </Card>

      {result && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="red">Đã thu hồi</Badge>
            <span className="text-sm text-white">{result.message}</span>
          </div>
          <CopyField label="Credential ID đã thu hồi" value={result.credentialId} truncate={false} />
          <div className="mt-4 flex items-start gap-2 bg-[#0f1520] border border-[#1a2a3a] rounded-xl px-4 py-3">
            <span className="text-blue-400 text-sm shrink-0 mt-0.5">ℹ</span>
            <p className="text-xs text-[#888] leading-relaxed">
              Văn bằng cũ đã bị thu hồi.{' '}
              <span className="text-white">Bạn có thể cấp lại văn bằng mới cho sinh viên này</span>{' '}
              bằng cách quay về tab Phát hành.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[#555] text-xs">{label}</span>
      <span className="text-[#aaa] break-all">{value}</span>
    </div>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────
const WORKFLOW = ['Đăng ký tổ chức', 'Phát hành văn bằng', 'Thu hồi văn bằng']
const TABS = [
  { id: 'register', label: 'Đăng ký tổ chức' },
  { id: 'issue',    label: 'Phát hành văn bằng' },
  { id: 'revoke',   label: 'Thu hồi văn bằng' },
]

export default function IssuerDashboard() {
  const { issuer } = useIssuer()
  const [tab, setTab]                   = useState('register')
  const [issuedDone, setIssuedDone]     = useState(false)
  const [lastCredentialId, setLastCredentialId] = useState('')

  const activeStep     = tab === 'register' ? 0 : tab === 'issue' ? 1 : 2
  const completedSteps = [issuer ? 0 : null, issuedDone ? 1 : null].filter(s => s !== null)

  return (
    <DashboardLayout
      title="Tổ chức cấp bằng"
      subtitle="Quản lý phát hành và thu hồi văn bằng học thuật số"
    >
      <WorkflowStepper steps={WORKFLOW} activeStep={activeStep} completedSteps={completedSteps} />

      <div className="flex items-center gap-1 border border-[#1d1d1d] bg-[#0d0d0d] rounded-full p-1 w-fit mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              tab === t.id ? 'bg-[#1d1d1d] text-white' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {t.label}
            {t.id === 'register' && issuer && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
          </button>
        ))}
      </div>

      {tab === 'register' && <RegisterTab onRegistered={() => setTab('issue')} />}
      {tab === 'issue' && (
        <IssueTab
          onIssued={(id) => { setIssuedDone(true); setLastCredentialId(id || '') }}
          onGoToRevoke={() => setTab('revoke')}
        />
      )}
      {tab === 'revoke' && <RevokeTab lastCredentialId={lastCredentialId} />}
    </DashboardLayout>
  )
}
