import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { connectWallet as _connect } from '../services/wallet'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)

  // Ref tracks latest wallet so event handlers can check without stale closure
  const walletRef = useRef(null)
  useEffect(() => { walletRef.current = wallet }, [wallet])

  // No auto-reconnect — user connects manually via button
  useEffect(() => {
    if (!window.ethereum) return

    // When user switches account in MetaMask
    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setWallet(null)
      } else {
        _connect().then(setWallet).catch(() => setWallet(null))
      }
    }

    // When user switches network in MetaMask — recreate provider/signer for new chain
    const onChainChanged = () => {
      if (walletRef.current) {
        _connect().then(setWallet).catch(() => setWallet(null))
      }
    }

    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum.removeListener('chainChanged', onChainChanged)
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      const w = await _connect()
      setWallet(w)
      return w
    } catch (e) {
      setConnectError(e?.message || 'Không thể kết nối MetaMask')
      throw e
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => { setWallet(null); setConnectError(null) }, [])

  // Ask MetaMask to switch to Hardhat localhost (Chain 31337 = 0x7A69)
  const switchToHardhat = useCallback(async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }],
      })
    } catch (err) {
      // Chain not added yet — add it automatically
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7A69',
            chainName: 'Hardhat Localhost',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['http://127.0.0.1:8545'],
          }],
        })
      }
    }
  }, [])

  return (
    <WalletContext.Provider value={{ wallet, connecting, connectError, connect, disconnect, switchToHardhat }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
