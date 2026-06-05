import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { APP_NAME, APP_TAGLINE, APP_ABBR } from '../config/branding'

const features = [
  {
    icon: '🔐',
    title: 'Chữ ký ECC qua MetaMask',
    desc: 'Trường đại học ký văn bằng bằng ví MetaMask của mình (secp256k1 / ECDSA). Không thể làm giả, không cần lưu private key trên server.',
  },
  {
    icon: '🌿',
    title: 'Merkle Selective Disclosure',
    desc: 'Mỗi môn học là một leaf trong Merkle Tree. Sinh viên chỉ tiết lộ đúng môn cần chứng minh — không lộ toàn bộ bảng điểm.',
  },
  {
    icon: '⛓️',
    title: 'Registry On-Chain',
    desc: 'Danh sách issuer ủy quyền và revocation list lưu trên Ethereum. Admin thêm/xóa issuer qua smart contract.',
  },
  {
    icon: '✅',
    title: 'Xác minh phi tập trung',
    desc: 'Verifier kiểm tra trực tiếp: on-chain registry + ECC signature + Merkle proof. Không cần liên hệ trường.',
  },
]

const steps = [
  { num: '01', role: 'Admin', action: 'Kết nối MetaMask (owner wallet), gọi addIssuer để ủy quyền cho trường đại học.' },
  { num: '02', role: 'Tổ chức cấp bằng', action: 'Kết nối MetaMask (issuer wallet), nhập bảng điểm, ký bằng ECC → tải credential.json.' },
  { num: '03', role: 'Sinh viên', action: 'Kết nối MetaMask, upload credential.json, chọn môn cần tiết lộ → tải proof.json.' },
  { num: '04', role: 'Verifier', action: 'Upload proof.json → hệ thống kiểm tra on-chain + ECC + Merkle → Valid / Invalid.' },
]

const roleCards = [
  {
    to: '/admin',
    icon: '🛡',
    title: 'Admin',
    desc: 'Thêm / xóa tổ chức cấp bằng ủy quyền trên smart contract.',
    btn: 'Quản lý Issuer',
    accent: 'border-orange-500/20 hover:border-orange-500/40',
    badge: 'bg-orange-500/10 text-orange-400',
  },
  {
    to: '/issuer',
    icon: '🏛',
    title: 'Tổ chức cấp bằng',
    desc: 'Ký và phát hành văn bằng học thuật số bằng MetaMask.',
    btn: 'Phát hành văn bằng',
    accent: 'border-[#6c47ff]/20 hover:border-[#6c47ff]/40',
    badge: 'bg-[#6c47ff]/10 text-[#6c47ff]',
  },
  {
    to: '/student',
    icon: '🎓',
    title: 'Sinh viên',
    desc: 'Xác nhận văn bằng và tạo Merkle proof chọn lọc.',
    btn: 'Xem văn bằng',
    accent: 'border-blue-500/20 hover:border-blue-500/40',
    badge: 'bg-blue-500/10 text-blue-400',
  },
  {
    to: '/verifier',
    icon: '🔍',
    title: 'Verifier',
    desc: 'Xác minh proof mà không cần xem toàn bộ bảng điểm.',
    btn: 'Xác minh ngay',
    accent: 'border-green-500/20 hover:border-green-500/40',
    badge: 'bg-green-500/10 text-green-400',
  },
]

export default function Landing() {
  return (
    <MainLayout>
      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[400px] rounded-full bg-[#6c47ff]/8 blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 border border-[#222] bg-[#111] rounded-full px-4 py-1.5 text-xs text-[#888] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6c47ff] animate-pulse" />
            MetaMask · ECC · Merkle Tree · On-chain
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-3">
            <span className="bg-gradient-to-r from-[#6c47ff] to-[#3b82f6] bg-clip-text text-transparent">
              {APP_NAME}
            </span>
          </h1>
          <p className="text-base md:text-lg font-medium text-[#6c7fff] tracking-wide mb-6">
            {APP_TAGLINE}
          </p>
          <p className="text-lg text-[#888] max-w-2xl mx-auto mb-10 leading-relaxed">
            Hệ thống cấp phát và xác minh bằng cấp học thuật trên Ethereum.
            Ký bằng MetaMask, selective disclosure qua Merkle Tree, registry on-chain.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/issuer" className="bg-[#6c47ff] hover:bg-[#7c5aff] text-white font-medium px-8 py-3.5 rounded-full transition-colors text-sm">
              Phát hành văn bằng →
            </Link>
            <Link to="/verifier" className="border border-[#333] hover:border-[#555] text-white font-medium px-8 py-3.5 rounded-full transition-colors text-sm">
              Xác minh chứng chỉ
            </Link>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ───────────────────────────────────────────── */}
      <section className="border-y border-[#1a1a1a] bg-[#0d0d0d]">
        <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-4 gap-8 text-center">
          {[
            { val: 'MetaMask', sub: 'ECC secp256k1 sign' },
            { val: 'Merkle', sub: 'Selective disclosure' },
            { val: 'On-chain', sub: 'Registry & Revocation' },
            { val: 'EIP-191', sub: 'Personal sign' },
          ].map((s) => (
            <div key={s.val}>
              <div className="text-xl font-bold text-white">{s.val}</div>
              <div className="text-xs text-[#555] mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ROLE CARDS ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs text-[#6c47ff] font-medium uppercase tracking-widest mb-3">Vai trò trong hệ thống</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">4 thành phần tham gia</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleCards.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={`bg-[#111] border ${r.accent} rounded-2xl p-6 hover:bg-[#141414] transition-all group`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-2xl">{r.icon}</div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.badge}`}>{r.title}</span>
              </div>
              <h3 className="text-white font-semibold mb-2">{r.title}</h3>
              <p className="text-[#666] text-sm leading-relaxed mb-4">{r.desc}</p>
              <span className="text-xs text-[#6c47ff] group-hover:text-white transition-colors">{r.btn} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────────── */}
      <section className="bg-[#0d0d0d] border-y border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-xs text-[#6c47ff] font-medium uppercase tracking-widest mb-3">Tính năng cốt lõi</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Bảo mật ở mọi lớp</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="bg-[#111] border border-[#1d1d1d] rounded-2xl p-6 hover:border-[#2a2a2a] transition-colors">
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-[#666] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs text-[#6c47ff] font-medium uppercase tracking-widest mb-3">Quy trình</p>
          <h2 className="text-3xl font-bold text-white">Hoạt động như thế nào?</h2>
        </div>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.num} className="flex items-start gap-5 bg-[#111] border border-[#1d1d1d] rounded-xl p-5">
              <span className="text-xs font-bold text-[#6c47ff] bg-[#6c47ff]/10 border border-[#6c47ff]/20 rounded-lg px-2.5 py-1 mt-0.5 shrink-0">
                {s.num}
              </span>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{s.role}</div>
                <div className="text-sm text-[#666]">{s.action}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#6c47ff] flex items-center justify-center text-white text-xs font-bold">{APP_ABBR}</div>
            <span className="text-sm text-[#555]">{APP_NAME} — IT4527E Capstone Project</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#444]">
            <span>Blockchain · ECC · Merkle Tree</span>
            <span>Hardhat localhost / Ethereum</span>
          </div>
        </div>
      </footer>
    </MainLayout>
  )
}
