import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_API_KEY || '',
  },
})

// Issuer
export const registerIssuer = (data) => api.post('/issuer/register', data)

// Credential
export const issueCredential = (data) => api.post('/credential/issue', data)
export const revokeCredential = (credentialId) => api.post('/credential/revoke', { credentialId })
export const getCredential = (id) => api.get(`/credential/${id}`)

// Proof
export const generateProof = (credentialId, courseCode) =>
  api.post('/proof/generate', { credentialId, courseCode })
export const verifyProof = (data) => api.post('/proof/verify', data)
