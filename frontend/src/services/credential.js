/**
 * Credential JSON builder, hasher, signer, and validator.
 *
 * Credential JSON schema (schemaVersion 1.0):
 *   credentialId, studentWallet, studentName, studentId,
 *   issuerWallet, universityName, merkleRoot, courses[],
 *   issuedAt, chainId, contractAddress, credentialHash, issuerSignature
 *
 * Proof JSON schema (schemaVersion 1.0):
 *   credentialId, issuerWallet, universityName, studentWallet, studentName, studentId,
 *   merkleRoot, credentialHash, issuerSignature, contractAddress, chainId, issuedAt,
 *   selectedCourses[{ courseCode, courseName, grade, leafHash, merkleProof[] }]
 */
import { ethers } from 'ethers'
import { generateRoot, generateProof, hashLeaf, verifyProof } from './merkle'

// ─── Hashing ─────────────────────────────────────────────────────────────────

/** Unique ID for a credential (bytes32 hex). */
export function computeCredentialId(studentWallet, issuerWallet, issuedAt) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(
      `${studentWallet.toLowerCase()}:${issuerWallet.toLowerCase()}:${issuedAt}`
    )
  )
}

/**
 * The hash that gets ECC-signed by the issuer.
 * Deterministic: same fields always → same hash.
 */
export function computeCredentialHash(cred) {
  const parts = [
    cred.credentialId,
    cred.merkleRoot,
    cred.issuerWallet.toLowerCase(),
    cred.studentWallet.toLowerCase(),
    cred.issuedAt,
    String(cred.chainId),
    cred.contractAddress.toLowerCase(),
  ].join('|')
  return ethers.keccak256(ethers.toUtf8Bytes(parts))
}

// ─── Signing ─────────────────────────────────────────────────────────────────

/**
 * Sign credentialHash with MetaMask (EIP-191 personal sign).
 * Returns 65-byte hex signature.
 */
export async function signCredential(signer, credentialHash) {
  return signer.signMessage(ethers.getBytes(credentialHash))
}

/**
 * Recover signer address from signature and verify it matches expectedIssuer.
 */
export function verifyCredentialSignature(credentialHash, signature, expectedIssuer) {
  try {
    const recovered = ethers.verifyMessage(ethers.getBytes(credentialHash), signature)
    return recovered.toLowerCase() === expectedIssuer.toLowerCase()
  } catch {
    return false
  }
}

// ─── JSON builders ───────────────────────────────────────────────────────────

export function buildCredentialJSON(params) {
  const {
    studentWallet, studentName, studentId,
    issuerWallet, universityName, courses,
    chainId, contractAddress,
  } = params

  const issuedAt = new Date().toISOString()
  const credentialId = computeCredentialId(studentWallet, issuerWallet, issuedAt)
  const merkleRoot = generateRoot(courses)

  return {
    _meta: { credentialId, merkleRoot, issuedAt },
    credentialId,
    studentWallet,
    studentName,
    studentId,
    issuerWallet,
    universityName,
    merkleRoot,
    courses,
    issuedAt,
    chainId,
    contractAddress,
    // credentialHash and issuerSignature filled after signing
  }
}

export function buildProofJSON(credential, selectedCourseCodes) {
  const proofEntries = []
  for (const code of selectedCourseCodes) {
    const course = credential.courses.find(c => c.courseCode === code)
    if (!course) continue
    const result = generateProof(credential.courses, code)
    if (!result) continue
    proofEntries.push({
      courseCode: course.courseCode,
      courseName: course.courseName || '',
      grade: course.grade,
      leafHash: result.leaf,
      merkleProof: result.proof,
    })
  }
  return {
    schemaVersion: '1.0',
    credentialId: credential.credentialId,
    issuerWallet: credential.issuerWallet,
    universityName: credential.universityName,
    studentWallet: credential.studentWallet,
    studentName: credential.studentName,
    studentId: credential.studentId,
    merkleRoot: credential.merkleRoot,
    credentialHash: credential.credentialHash,
    issuerSignature: credential.issuerSignature,
    contractAddress: credential.contractAddress,
    chainId: credential.chainId,
    issuedAt: credential.issuedAt,
    selectedCourses: proofEntries,
  }
}

// ─── Schema validators ───────────────────────────────────────────────────────

export function validateCredentialSchema(json) {
  const required = [
    'schemaVersion', 'credentialId', 'studentWallet', 'studentName', 'studentId',
    'issuerWallet', 'universityName', 'merkleRoot', 'courses',
    'issuedAt', 'chainId', 'contractAddress', 'credentialHash', 'issuerSignature',
  ]
  for (const f of required) {
    if (json[f] === undefined || json[f] === null || json[f] === '') {
      return { valid: false, error: `Thiếu trường bắt buộc: "${f}"` }
    }
  }
  if (!Array.isArray(json.courses) || json.courses.length === 0) {
    return { valid: false, error: 'courses phải là mảng có ít nhất 1 phần tử' }
  }
  return { valid: true }
}

export function validateProofSchema(json) {
  const required = [
    'schemaVersion', 'credentialId', 'issuerWallet', 'merkleRoot',
    'credentialHash', 'issuerSignature', 'contractAddress', 'chainId',
    'selectedCourses',
  ]
  for (const f of required) {
    if (json[f] === undefined || json[f] === null) {
      return { valid: false, error: `Thiếu trường bắt buộc: "${f}"` }
    }
  }
  if (!Array.isArray(json.selectedCourses) || json.selectedCourses.length === 0) {
    return { valid: false, error: 'selectedCourses phải là mảng không rỗng' }
  }
  for (const sc of json.selectedCourses) {
    if (!sc.courseCode || !sc.grade || !sc.leafHash || !Array.isArray(sc.merkleProof)) {
      return { valid: false, error: `selectedCourses entry thiếu courseCode/grade/leafHash/merkleProof` }
    }
  }
  return { valid: true }
}

// ─── Full credential validation (off-chain only) ─────────────────────────────

export function validateCredentialOffChain(json, connectedWallet) {
  const results = {}

  // 1. Schema
  const schemaCheck = validateCredentialSchema(json)
  results.schema = schemaCheck.valid
  if (!schemaCheck.valid) return { ...results, error: schemaCheck.error }

  // 2. Student wallet matches connected wallet
  results.walletMatch = json.studentWallet.toLowerCase() === connectedWallet.toLowerCase()

  // 3. Recompute credentialHash and check it matches JSON
  const recomputed = computeCredentialHash(json)
  results.hashConsistent = recomputed.toLowerCase() === json.credentialHash.toLowerCase()

  // 4. ECC signature
  results.signatureValid = verifyCredentialSignature(json.credentialHash, json.issuerSignature, json.issuerWallet)

  // 5. Merkle root recomputation
  const recomputedRoot = generateRoot(json.courses)
  results.merkleRootConsistent = recomputedRoot.toLowerCase() === json.merkleRoot.toLowerCase()

  return results
}

// ─── Full proof validation (off-chain only) ──────────────────────────────────

export function validateProofOffChain(json) {
  const results = {}

  // 1. Schema
  const schemaCheck = validateProofSchema(json)
  results.schema = schemaCheck.valid
  if (!schemaCheck.valid) return { ...results, error: schemaCheck.error }

  // 2. Signature
  results.signatureValid = verifyCredentialSignature(json.credentialHash, json.issuerSignature, json.issuerWallet)

  // 3. Each selected course: leaf hash correct + merkle proof valid
  results.courses = []
  for (const sc of json.selectedCourses) {
    const expectedLeaf = hashLeaf({ courseCode: sc.courseCode, grade: sc.grade })
    const leafMatch = expectedLeaf.toLowerCase() === sc.leafHash.toLowerCase()
    const proofOk = verifyProof(sc.merkleProof, sc.leafHash, json.merkleRoot)
    results.courses.push({
      courseCode: sc.courseCode,
      grade: sc.grade,
      leafMatch,
      proofValid: proofOk,
      valid: leafMatch && proofOk,
    })
  }
  results.allCoursesValid = results.courses.every(c => c.valid)

  return results
}
