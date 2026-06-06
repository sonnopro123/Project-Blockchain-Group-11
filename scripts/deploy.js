/**
 * Deploy CredentialRegistry to selected network.
 * Usage: npx hardhat run scripts/deploy.js --network localhost
 *        npx hardhat run scripts/deploy.js --network sepolia
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const Factory = await ethers.getContractFactory('CredentialRegistry');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log('\n✅ Contract deployed to:', address);
  console.log('📋 Copy address trên vào file .env: CONTRACT_ADDRESS=' + address + '\n');

  // Helper: upsert a key=value line in an env file
  function upsertEnv(filePath, key, value) {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += (content.endsWith('\n') || content === '' ? '' : '\n') + `${key}=${value}\n`;
    }
    fs.writeFileSync(filePath, content);
  }

  // Update root .env (backend)
  const rootEnv = path.join(__dirname, '..', '.env');
  upsertEnv(rootEnv, 'CONTRACT_ADDRESS', address);
  console.log('✅ Đã cập nhật CONTRACT_ADDRESS trong .env');

  // Update frontend/.env (Vite)
  const frontendEnv = path.join(__dirname, '..', 'frontend', '.env');
  upsertEnv(frontendEnv, 'VITE_CONTRACT_ADDRESS', address);
  if (!fs.readFileSync(frontendEnv, 'utf8').includes('VITE_RPC_URL=')) {
    fs.appendFileSync(frontendEnv, 'VITE_RPC_URL=http://127.0.0.1:8545\n');
  }
  console.log('✅ Đã cập nhật VITE_CONTRACT_ADDRESS trong frontend/.env');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
