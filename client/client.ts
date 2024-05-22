import { web3 } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import type { Lifafa } from "../target/types/lifafa";
import {
  loadWallet,
  getBalance,
  createLifafa,
  claimLifafa,
  deleteLifafa,
  generateLifafaId,
  findLifafaState,
  toSol
} from './utils';

const secretKeyPath = "/home/jovian/.config/solana/id.json";

async function initialize(secretKeyPath: string) {
  const wallet = await loadWallet(secretKeyPath);
  console.log("Wallet loaded");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Lifafa as anchor.Program<Lifafa>;

  return { wallet, provider, program };
}


async function main() {
  const { wallet, provider, program } = await initialize(secretKeyPath);
  const id = generateLifafaId();
  const amount = web3.LAMPORTS_PER_SOL * 0.1;
  const timeLimit = 1000;
  const maxClaims = 2
  const ownerName = "jovian"
  const desc = "Gift"

  const [lifafaState] = findLifafaState(program.programId, id);

  console.log("Program Id:", program.programId.toBase58());
  console.log("My address:", provider.wallet.publicKey.toString());

  const printBalances = async () => {
    const myBalance = await getBalance(provider.connection, provider.wallet.publicKey);
    console.log(`My balance: ${myBalance} SOL`);
    
    const lifafaBalance = await getBalance(provider.connection, lifafaState);
    console.log(`Lifafa balance: ${lifafaBalance} SOL`);
  };

  await createLifafa(
    program, 
    provider, 
    wallet, 
    id, 
    amount, 
    timeLimit,
    maxClaims,
    ownerName, 
    desc,
    lifafaState);
  await printBalances();
  
  await claimLifafa(program, provider, wallet, id, lifafaState);
  await printBalances();
  
  // await claimLifafa(program, provider, wallet, id, lifafaState); // Should throw an error when claiming second time
  
  await deleteLifafa(program, provider, wallet, id, lifafaState);
  await printBalances();
}

main().catch(console.error);
