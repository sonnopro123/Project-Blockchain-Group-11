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

  // Auto-write CONTRACT_ADDRESS into .env if the file exists
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (/^CONTRACT_ADDRESS=.*/m.test(envContent)) {
      envContent = envContent.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
    } else {
      envContent += `\nCONTRACT_ADDRESS=${address}`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Đã tự động cập nhật CONTRACT_ADDRESS trong .env');
  } else {
    console.log('⚠️  File .env chưa tồn tại. Tạo từ .env.example rồi điền địa chỉ trên.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
