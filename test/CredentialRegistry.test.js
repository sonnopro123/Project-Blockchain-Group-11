/**
 * Hardhat unit tests for CredentialRegistry.sol
 * Run: npx hardhat test
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CredentialRegistry', function () {
  let registry;
  let owner, issuer1, issuer2, other;

  const CRED_HASH   = ethers.keccak256(ethers.toUtf8Bytes('test-credential-hash'));
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
  // issueCredential
  // -------------------------------------------------------------------------
  describe('issueCredential', function () {
    beforeEach(async function () {
      await registry.addIssuer(issuer1.address);
    });

    it('authorized issuer can issue a credential', async function () {
      await registry.connect(issuer1).issueCredential(CRED_HASH);
      expect(await registry.credentialIssuers(CRED_HASH)).to.equal(issuer1.address);
    });

    it('emits CredentialIssued', async function () {
      await expect(registry.connect(issuer1).issueCredential(CRED_HASH))
        .to.emit(registry, 'CredentialIssued')
        .withArgs(CRED_HASH, issuer1.address);
    });

    it('non-issuer cannot issue', async function () {
      await expect(registry.connect(other).issueCredential(CRED_HASH))
        .to.be.revertedWith('Not authorized issuer');
    });

    it('cannot issue same credential hash twice', async function () {
      await registry.connect(issuer1).issueCredential(CRED_HASH);
      await expect(registry.connect(issuer1).issueCredential(CRED_HASH))
        .to.be.revertedWith('Already issued');
    });

    it('two issuers can issue different credentials', async function () {
      await registry.addIssuer(issuer2.address);
      await registry.connect(issuer1).issueCredential(CRED_HASH);
      await registry.connect(issuer2).issueCredential(CRED_HASH_2);
      expect(await registry.credentialIssuers(CRED_HASH)).to.equal(issuer1.address);
      expect(await registry.credentialIssuers(CRED_HASH_2)).to.equal(issuer2.address);
    });
  });

  // -------------------------------------------------------------------------
  // revokeCredential
  // -------------------------------------------------------------------------
  describe('revokeCredential', function () {
    beforeEach(async function () {
      await registry.addIssuer(issuer1.address);
      // issuer1 must issue before they can revoke
      await registry.connect(issuer1).issueCredential(CRED_HASH);
    });

    it('issuing issuer can revoke their credential', async function () {
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

    it('different authorized issuer CANNOT revoke another issuer\'s credential', async function () {
      await registry.addIssuer(issuer2.address);
      await expect(registry.connect(issuer2).revokeCredential(CRED_HASH))
        .to.be.revertedWith('Only issuing issuer can revoke');
    });

    it('cannot revoke without issuing first', async function () {
      const UNISSUED = ethers.keccak256(ethers.toUtf8Bytes('never-issued'));
      await expect(registry.connect(issuer1).revokeCredential(UNISSUED))
        .to.be.revertedWith('Only issuing issuer can revoke');
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

    it('each issuer can only revoke their own credentials', async function () {
      await registry.addIssuer(issuer2.address);
      await registry.connect(issuer2).issueCredential(CRED_HASH_2);

      await registry.connect(issuer1).revokeCredential(CRED_HASH);
      await registry.connect(issuer2).revokeCredential(CRED_HASH_2);

      expect(await registry.isRevoked(CRED_HASH)).to.be.true;
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

    it('credentialIssuers returns zero address for unissued hash', async function () {
      expect(await registry.credentialIssuers(CRED_HASH)).to.equal(ethers.ZeroAddress);
    });
  });
});
