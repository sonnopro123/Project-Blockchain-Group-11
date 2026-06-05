import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { APP_NAME, APP_ABBR } from '../config/branding'

const links = [
  { to: '/',         label: 'Trang chủ' },
  { to: '/admin',    label: 'Admin' },
  { to: '/issuer',   label: 'Tổ chức cấp bằng' },
  { to: '/student',  label: 'Sinh viên' },
  { to: '/verifier', label: 'Xác minh' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between relative">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#6c47ff] flex items-center justify-center text-white text-xs font-bold">
            {APP_ABBR}
          </div>
          <span className="text-sm font-semibold text-white">{APP_NAME}</span>
        </Link>

        {/* Links desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                pathname === l.to
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link
            to="/issuer"
            className="hidden md:block bg-[#6c47ff] hover:bg-[#7c5aff] text-white text-sm px-4 py-1.5 rounded-full transition-colors"
          >
            Bắt đầu
          </Link>

          {/* Hamburger mobile */}
          <button
            className="md:hidden text-white text-xl w-8 h-8 flex items-center justify-center"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-[#111] border-t border-[#1a1a1a] px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm transition-colors ${
                pathname === l.to ? 'bg-[#1a1a1a] text-white' : 'text-[#888] hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/issuer"
            onClick={() => setMenuOpen(false)}
            className="mt-2 bg-[#6c47ff] hover:bg-[#7c5aff] text-white text-sm px-4 py-2.5 rounded-xl transition-colors text-center"
          >
            Bắt đầu
          </Link>
        </div>
      )}
    </nav>
  )
}
