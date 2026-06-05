/**
 * Merkle Tree implementation using ethers.js keccak256.
 * Leaf format: keccak256("courseCode|grade")  — matches backend merkleService.js
 * Internal nodes: sortPairs=true (smaller hex first before hashing)
 */
import { ethers } from 'ethers'

// Hash a single course leaf
export function hashLeaf(course) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${course.courseCode}|${course.grade}`)
  )
}

// Hash two sibling nodes, sorting them first (sortPairs=true equivalent)
function hashPair(a, b) {
  const [lo, hi] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
  return ethers.keccak256(
    ethers.concat([ethers.getBytes(lo), ethers.getBytes(hi)])
  )
}

// Build tree layers from courses. Returns array of levels (leaves first).
function buildLayers(courses) {
  if (!courses || courses.length === 0) return []
  const leaves = courses.map(hashLeaf)
  const layers = [leaves]
  let current = [...leaves]
  while (current.length > 1) {
    const next = []
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]))
      } else {
        // Odd node: promote as-is (merkletreejs behavior)
        next.push(current[i])
      }
    }
    layers.push(next)
    current = next
  }
  return layers
}

/** Returns the hex merkle root (0x-prefixed) for a list of courses. */
export function generateRoot(courses) {
  const layers = buildLayers(courses)
  if (layers.length === 0) return ethers.ZeroHash
  return layers[layers.length - 1][0]
}

/**
 * Generate a Merkle proof for a specific course.
 * @returns {{ proof: string[], leaf: string }} or null if not found
 */
export function generateProof(courses, targetCourseCode) {
  const layers = buildLayers(courses)
  if (layers.length === 0) return null
  const course = courses.find(c => c.courseCode === targetCourseCode)
  if (!course) return null
  const targetLeaf = hashLeaf(course)
  let idx = layers[0].findIndex(l => l.toLowerCase() === targetLeaf.toLowerCase())
  if (idx === -1) return null

  const proof = []
  for (let i = 0; i < layers.length - 1; i++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1
    if (siblingIdx < layers[i].length) {
      proof.push(layers[i][siblingIdx])
    }
    idx = Math.floor(idx / 2)
  }
  return { proof, leaf: targetLeaf }
}

/** Verify a Merkle proof. Returns true if valid. */
export function verifyProof(proof, leaf, root) {
  let computed = leaf
  for (const sibling of proof) {
    computed = hashPair(computed, sibling)
  }
  return computed.toLowerCase() === root.toLowerCase()
}
