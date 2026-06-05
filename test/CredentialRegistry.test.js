/**
 * Hardhat unit tests for CredentialRegistry.sol
 * Run: npx hardhat test
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CredentialRegistry', function () {
  let registry;
  let owner, issuer1, issuer2, other;

  const CRED_HASH = ethers.keccak256(ethers.toUtf8Bytes('test-credential-hash'));
  const CRED_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes('test-credential-hash-2'));

  beforeEach(async function () {
    [owner, issuer1, issuer2, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('CredentialRegistry');
    registry = await Factory.deploy();
  });

  // -------------------------------------------------------------------------
  // Ownership
  // -------------------------------------------------------------------------
  describe('owner', function () {
    it('deployer is owner', async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  // -------------------------------------------------------------------------
  // addIssuer
  // -------------------------------------------------------------------------
  describe('addIssuer', function () {
    it('owner can add issuer', async function () {
      await registry.addIssuer(issuer1.address);
      expect(await registry.isAuthorizedIssuer(issuer1.address)).to.be.true;
    });

    it('authorizedIssuers mapping is updated', async function () {
      await registry.addIssuer(issuer1.address);
      expect(await registry.authorizedIssuers(issuer1.address)).to.be.true;
    });

    it('emits IssuerAdded', async function () {
      await expect(registry.addIssuer(issuer1.address))
        .to.emit(registry, 'IssuerAdded')
        .withArgs(issuer1.address);
    });

    it('non-owner cannot add issuer', async function () {
      await expect(registry.connect(other).addIssuer(issuer1.address))
        .to.be.revertedWith('Not owner');
    });

    it('reverts on zero address', async function () {
      await expect(registry.addIssuer(ethers.ZeroAddress))
        .to.be.revertedWith('Zero address');
    });

    it('can add same issuer multiple times (idempotent)', async function () {
      await registry.addIssuer(issuer1.address);
      await registry.addIssuer(issuer1.address); // no revert
      expect(await registry.isAuthorizedIssuer(issuer1.address)).to.be.true;
    });
  });

  // -------------------------------------------------------------------------
  // removeIssuer
  // -------------------------------------------------------------------------
  describe('removeIssuer', function () {
    beforeEach(async function () {
      await registry.addIssuer(issuer1.address);
    });

    it('owner can remove issuer', async function () {
      await registry.removeIssuer(issuer1.address);
      expect(await registry.isAuthorizedIssuer(issuer1.address)).to.be.false;
    });

    it('emits IssuerRemoved', async function () {
      await expect(registry.removeIssuer(issuer1.address))
        .to.emit(registry, 'IssuerRemoved')
        .withArgs(issuer1.address);
    });

    it('non-owner cannot remove issuer', async function () {
      await expect(registry.connect(other).removeIssuer(issuer1.address))
        .to.be.revertedWith('Not owner');
    });
  });

  // -------------------------------------------------------------------------
  // revokeCredential
  // -------------------------------------------------------------------------
  describe('revokeCredential', function () {
    beforeEach(async function () {
      await registry.addIssuer(issuer1.address);
    });

    it('authorized issuer can revoke credential', async function () {
      await registry.connect(issuer1).revokeCredential(CRED_HASH);
      expect(await registry.isRevoked(CRED_HASH)).to.be.true;
    });

    it('revokedCredentials mapping is updated', async function () {
      await registry.connect(issuer1).revokeCredential(CRED_HASH);
      expect(await registry.revokedCredentials(CRED_HASH)).to.be.true;
    });

    it('emits CredentialRevoked', async function () {
      await expect(registry.connect(issuer1).revokeCredential(CRED_HASH))
        .to.emit(registry, 'CredentialRevoked')
        .withArgs(CRED_HASH, issuer1.address);
    });

    it('non-issuer cannot revoke', async function () {
      await expect(registry.connect(other).revokeCredential(CRED_HASH))
        .to.be.revertedWith('Not authorized issuer');
    });

    it('cannot revoke same credential twice', async function () {
      await registry.connect(issuer1).revokeCredential(CRED_HASH);
      await expect(registry.connect(issuer1).revokeCredential(CRED_HASH))
        .to.be.revertedWith('Already revoked');
    });

    it('removed issuer cannot revoke', async function () {
      await registry.removeIssuer(issuer1.address);
      await expect(registry.connect(issuer1).revokeCredential(CRED_HASH))
        .to.be.revertedWith('Not authorized issuer');
    });

    it('different credentials can be revoked independently', async function () {
      await registry.connect(issuer1).revokeCredential(CRED_HASH);
      expect(await registry.isRevoked(CRED_HASH)).to.be.true;
      expect(await registry.isRevoked(CRED_HASH_2)).to.be.false;
    });

    it('second issuer can also revoke credentials', async function () {
      await registry.addIssuer(issuer2.address);
      await registry.connect(issuer2).revokeCredential(CRED_HASH_2);
      expect(await registry.isRevoked(CRED_HASH_2)).to.be.true;
    });
  });

  // -------------------------------------------------------------------------
  // isAuthorizedIssuer / isRevoked
  // -------------------------------------------------------------------------
  describe('read helpers', function () {
    it('isAuthorizedIssuer returns false for unknown address', async function () {
      expect(await registry.isAuthorizedIssuer(other.address)).to.be.false;
    });

    it('isRevoked returns false for unknown hash', async function () {
      expect(await registry.isRevoked(CRED_HASH)).to.be.false;
    });
  });
});
