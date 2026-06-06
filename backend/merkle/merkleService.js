/**
 * MODULE C — MERKLE ENGINE
 * Builds a Merkle Tree from transcript courses using merkletreejs + keccak256.
 */

const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('js-sha3');

/**
 * Hash a single course leaf.
 * Format: keccak256(courseCode|grade)
 * @param {{ courseCode: string, grade: string|number }} course
 * @returns {Buffer}
 */
function _hashLeaf(course) {
  const data = `${course.courseCode}|${course.grade}`;
  const hash = keccak256(data);
  return Buffer.from(hash, 'hex');
}

/**
 * Returns the 0x-prefixed hex leaf hash for a course. Used by verify endpoints
 * to recompute the expected leaf and reject tampered courseCode/grade claims.
 */
function hashLeafHex(course) {
  return '0x' + _hashLeaf(course).toString('hex');
}

/**
 * Build a Merkle Tree from an array of courses.
 * @param {Array<{ courseCode: string, grade: string|number }>} courses
 * @returns {{ tree: MerkleTree, leaves: Buffer[] }}
 */
function buildMerkleTree(courses) {
  if (!courses || courses.length === 0) {
    throw new Error('Courses array must not be empty');
  }
  const leaves = courses.map(_hashLeaf);
  const tree = new MerkleTree(leaves, (data) => Buffer.from(keccak256(data), 'hex'), {
    sortPairs: true,
  });
  return { tree, leaves };
}

/**
 * Get the hex Merkle root for a list of courses.
 * @param {Array<{ courseCode: string, grade: string|number }>} courses
 * @returns {string}  0x-prefixed hex root
 */
function generateRoot(courses) {
  const { tree } = buildMerkleTree(courses);
  return tree.getHexRoot();
}

/**
 * Generate a Merkle proof for a specific course.
 * @param {Array<{ courseCode: string, grade: string|number }>} courses  Full transcript.
 * @param {{ courseCode: string, grade: string|number }} targetCourse     Course to prove.
 * @returns {{ proof: string[], leaf: string, root: string }}
 */
function generateProof(courses, targetCourse) {
  const { tree, leaves } = buildMerkleTree(courses);
  const targetLeaf = _hashLeaf(targetCourse);

  // Find matching leaf index
  const leafIndex = leaves.findIndex((l) => l.toString('hex') === targetLeaf.toString('hex'));
  if (leafIndex === -1) {
    throw new Error(`Course "${targetCourse.courseCode}" not found in transcript`);
  }

  const proof = tree.getHexProof(targetLeaf);
  return {
    proof,
    leaf: '0x' + targetLeaf.toString('hex'),
    root: tree.getHexRoot(),
    courseCode: targetCourse.courseCode,
    grade: targetCourse.grade,
  };
}

/**
 * Verify a Merkle proof for a course.
 * @param {string[]} proof      Array of hex sibling hashes.
 * @param {string}   leaf       Hex leaf hash (0x-prefixed).
 * @param {string}   root       Hex Merkle root (0x-prefixed).
 * @returns {boolean}
 */
function verifyProof(proof, leaf, root) {
  const tree = new MerkleTree([], (data) => Buffer.from(keccak256(data), 'hex'), {
    sortPairs: true,
  });
  return tree.verify(proof, leaf, root);
}

module.exports = { buildMerkleTree, generateRoot, generateProof, verifyProof, hashLeafHex };
