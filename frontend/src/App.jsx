import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { WalletProvider } from './contexts/WalletContext'
import Landing from './pages/Landing'
import AdminDashboard from './pages/AdminDashboard'
import IssuerDashboard from './pages/IssuerDashboard'
import StudentDashboard from './pages/StudentDashboard'
import VerifierDashboard from './pages/VerifierDashboard'

export default function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"        element={<Landing />} />
            <Route path="/admin"   element={<AdminDashboard />} />
            <Route path="/issuer"  element={<IssuerDashboard />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/verifier" element={<VerifierDashboard />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </ToastProvider>
  )
}
