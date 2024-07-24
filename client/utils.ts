import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { web3, BN } from "@coral-xyz/anchor";
import { Lifafa } from "../target/types/lifafa";
import IDL from "../target/idl/lifafa.json";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";

const LIFAFA_SEED = "lifafa";

export async function loadWallet(secretKeyPath: string): Promise<web3.Keypair> {
  const secretKey = JSON.parse(fs.readFileSync(secretKeyPath, "utf8"));
  return web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

export async function getBalance(
  connection: web3.Connection,
  publicKey: web3.PublicKey
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / web3.LAMPORTS_PER_SOL;
}

export async function confirmTransaction(
  connection: web3.Connection,
  txHash: string
) {
  await connection.confirmTransaction(txHash);
  console.log(`TRANSACTION CONFIRMED -> ${txHash}`);
}

export function toSol(amount: number): number {
  return amount / web3.LAMPORTS_PER_SOL;
}

export async function createLifafa(
  program: anchor.Program<Lifafa>,
  provider: anchor.AnchorProvider,
  wallet: web3.Keypair,
  id: number,
  amount: number,
  timeLimit: number,
  maxClaims: number,
  ownerName: string,
  desc: string,
  lifafaState: web3.PublicKey
) {
  console.log(`\nCreate Lifafa, amount = ${toSol(amount)}, id = ${id}`);
  const txHash = await program.methods
    .createSolLifafa(
      new anchor.BN(id),
      new anchor.BN(amount),
      new anchor.BN(timeLimit),
      new anchor.BN(maxClaims),
      ownerName,
      desc
    )
    .accounts({
      lifafa: lifafaState,
      signer: provider.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([wallet])
    .rpc();
  await confirmTransaction(provider.connection, txHash);
}

export async function claimLifafa(
  program: anchor.Program<Lifafa>,
  provider: anchor.AnchorProvider,
  wallet: web3.Keypair,
  id: number,
  lifafaState: web3.PublicKey
) {
  console.log("\nClaiming Lifafa");
  const txHash = await program.methods
    .claimSolLifafa(new anchor.BN(id))
    .accounts({
      lifafa: lifafaState,
      signer: provider.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([wallet])
    .rpc();
  await confirmTransaction(provider.connection, txHash);
}

export async function deleteLifafa(
  program: anchor.Program<Lifafa>,
  provider: anchor.AnchorProvider,
  wallet: web3.Keypair,
  id: number,
  lifafaState: web3.PublicKey
) {
  console.log("\nDelete Lifafa");
  const txHash = await program.methods
    .deleteSolLifafa(new anchor.BN(id))
    .accounts({
      lifafa: lifafaState,
      signer: provider.wallet.publicKey,
    })
    .signers([wallet])
    .rpc();
  await confirmTransaction(provider.connection, txHash);
}

export function generateLifafaId(): number {
  return Math.floor(Math.random() * 10000000);
}

export function findLifafaState(
  programId: web3.PublicKey,
  id: number
): [web3.PublicKey, number] {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(LIFAFA_SEED, "utf8"), new BN(id).toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export async function createTokenMint(
  provider: anchor.AnchorProvider,
  wallet: web3.Keypair
) {
  const mint = await createMint(
    provider.connection,
    wallet, //payer
    wallet.publicKey, //mint authoritu
    null, //freeze authority
    6
  );
  return mint;
}

export async function createSplLifafa(
  provider: anchor.AnchorProvider,
  program: anchor.Program<Lifafa>,
  wallet: web3.Keypair,
  testData: TestInputData,
  mint: PublicKey,
  vault: PublicKey
) {
  console.log(
    `\nCreate Lifafa, amount = ${testData.amount}, id = ${testData.id}`
  );
  const txHash = await program.methods
    .createSplLifafa(
      new anchor.BN(testData.id),
      new anchor.BN(testData.amount),
      new anchor.BN(testData.timeLimit),
      new anchor.BN(testData.maxClaims),
      testData.ownerName,
      testData.desc
    )
    .accounts({
      mint: mint,
      vault: vault,
      signer: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([wallet])
    .rpc();
  await confirmTransaction(provider.connection, txHash);
}

export async function claimSplLifafa(
  provider: anchor.AnchorProvider,
  program: anchor.Program<Lifafa>,
  wallet: web3.Keypair,
  id: number,
  mint: PublicKey,
  vault: PublicKey
) {
  console.log("\nClaiming Lifafa");
  const txHash = await program.methods
    .claimSplLifafa(new anchor.BN(id))
    .accounts({
      mint: mint,
      vault: vault,
      signer: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([wallet])
    .rpc();
  await confirmTransaction(provider.connection, txHash);
}

export async function getTokenBalance(
  provider: anchor.AnchorProvider,
  tokenAccount: anchor.web3.PublicKey
) {
  const accountInfo = await provider.connection.getTokenAccountBalance(
    new PublicKey(tokenAccount)
  );
  return new BN(accountInfo.value.amount);
}

export async function getRequiredATA(
  provider: anchor.AnchorProvider,
  wallet: anchor.web3.Keypair,
  lifafaPDA: anchor.web3.PublicKey
) {
  const mintAmount = 1000 * 1e6;
  const mint = await createTokenMint(provider, wallet);
  console.log("Token mint: ", mint.toString());

  const ata = (
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet,
      mint,
      wallet.publicKey,
      false
    )
  ).address;
  await mintTo(
    provider.connection,
    wallet, //fee payer
    mint,
    ata,
    wallet, //mint authority
    mintAmount
  );

  const vault = (
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet,
      mint,
      lifafaPDA,
      true
    )
  ).address;
  await getATABalances(provider, ata, vault, true);
  return [mint, ata, vault];
}

export async function getATABalances(
  provider: anchor.AnchorProvider,
  ata: anchor.web3.PublicKey,
  vault: anchor.web3.PublicKey,
  print: boolean = false
) {
  const ataBal = await getTokenBalance(provider, ata);
  const vaultBal = await getTokenBalance(provider, vault);
  if (print) {
    console.log(`token account balance: ${ataBal.toString()}`);
    console.log(`vault account balance: ${vaultBal.toString()}`);
  }
  return [ataBal, vaultBal];
}

export interface LifafaData {
  id: BN;
  creationTime: BN;
  timeLimit: BN;
  owner: PublicKey;
  ownerName: string;
  claims: BN;
  maxClaims: BN;
  mintOfTokenBeingSent: PublicKey;
  amount: BN;
  desc: string;
}

export async function getLifafaData(program: anchor.Program<Lifafa>, id: number) {
  const [lifafaPDA] = findLifafaState(program.programId, id);
  return (await program.account.lifafa.fetch(lifafaPDA)) as LifafaData;
}

export interface TestInputData {
  id: number;
  timeLimit: number;
  maxClaims: number;
  ownerName: string;
  desc: string;
  amount: number;
}

export function getTestData(): TestInputData {
  return {
    id: generateLifafaId(),
    timeLimit: 1000,
    maxClaims: 5,
    ownerName: "jovian",
    desc: "Gift for winning the hackathon",
    amount: 100 * 1e6,
  }
}