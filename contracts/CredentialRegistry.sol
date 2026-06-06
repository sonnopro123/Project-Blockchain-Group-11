// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CredentialRegistry
/// @notice On-chain registry of authorized issuers (universities) and revoked credentials.
///         Credentials are issued and signed off-chain (ECC via MetaMask).
///         Only the revocation list and issuer registry live on-chain.
contract CredentialRegistry {
    address public owner;

    /// @notice Authorized issuer addresses (universities).
    mapping(address => bool) public authorizedIssuers;

    /// @notice Revoked credential hashes.
    mapping(bytes32 => bool) public revokedCredentials;

    /// @notice Maps credential hash → the issuer who issued it.
    ///         Only that issuer is allowed to revoke it.
    mapping(bytes32 => address) public credentialIssuers;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(bytes32 indexed credentialHash, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed revokedBy);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    constructor() {
        owner = msg.sender;
    }

    // -----------------------------------------------------------------------
    // Issuer Management — onlyOwner
    // -----------------------------------------------------------------------

    /// @notice Owner adds an authorized issuer (university).
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Zero address");
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Owner removes an authorized issuer.
    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    // -----------------------------------------------------------------------
    // Issuance — onlyAuthorizedIssuer
    // -----------------------------------------------------------------------

    /// @notice Issuer registers a credential on-chain after signing it off-chain.
    ///         Records msg.sender as the issuing issuer so only they can revoke it.
    /// @param credentialHash  keccak256 hash of the credential (computed off-chain).
    function issueCredential(bytes32 credentialHash) external onlyAuthorizedIssuer {
        require(credentialIssuers[credentialHash] == address(0), "Already issued");
        credentialIssuers[credentialHash] = msg.sender;
        emit CredentialIssued(credentialHash, msg.sender);
    }

    // -----------------------------------------------------------------------
    // Revocation — onlyAuthorizedIssuer
    // -----------------------------------------------------------------------

    /// @notice Authorized issuer revokes a credential by its off-chain hash.
    ///         If the credential was registered via issueCredential(), the caller
    ///         must be the same issuer who registered it.
    ///         If it was never registered on-chain (off-chain issuance only),
    ///         any authorized issuer may revoke.
    /// @param credentialHash  keccak256 hash of the credential.
    function revokeCredential(bytes32 credentialHash) external onlyAuthorizedIssuer {
        address registeredIssuer = credentialIssuers[credentialHash];
        if (registeredIssuer != address(0)) {
            require(registeredIssuer == msg.sender, "Only issuing issuer can revoke");
        }
        require(!revokedCredentials[credentialHash], "Already revoked");
        revokedCredentials[credentialHash] = true;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    // -----------------------------------------------------------------------
    // Read-only helpers
    // -----------------------------------------------------------------------

    /// @notice Check if an address is an authorized issuer.
    function isAuthorizedIssuer(address issuer) external view returns (bool) {
        return authorizedIssuers[issuer];
    }

    /// @notice Check if a credential has been revoked.
    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return revokedCredentials[credentialHash];
    }
}
