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
import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

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
      testData.desc,
      testData.claimMode
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
      signer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([wallet])
    .rpc();
  await confirmTransaction(provider.connection, txHash);
}

export async function deleteSplLifafa(
  provider: anchor.AnchorProvider,
  program: anchor.Program<Lifafa>,
  wallet: web3.Keypair,
  id: number,
  mint: PublicKey,
  vault: PublicKey
) {
  console.log("Delete Lifafa");
  const txHash = await program.methods
    .deleteSplLifafa(new anchor.BN(id))
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
  const accountInfo =
    await provider.connection.getTokenAccountBalance(tokenAccount);
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

  return [mint, ata, vault];
}

export async function createTestWallet(
  provider: anchor.AnchorProvider,
  signer: anchor.web3.Keypair,
  mint: PublicKey
): Promise<[anchor.web3.Keypair, PublicKey]> {
  const wallet = web3.Keypair.generate();
  const mintAmount = 1000 * 1e6;
  const ata = (
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      signer,
      mint,
      wallet.publicKey,
      false
    )
  ).address;
  // await mintTo(
  //   provider.connection,
  //   signer, //fee payer
  //   mint,
  //   ata,
  //   signer, //mint authority
  //   mintAmount
  // );

  // Transfer SOL from signer to wallet
  await transferSol(provider, signer, wallet.publicKey, 2 * LAMPORTS_PER_SOL); // Transfer 1 SOL (1e9 lamports)
  return [wallet, ata];
}

// Function to transfer SOL
async function transferSol(
  provider: anchor.AnchorProvider,
  from: anchor.web3.Keypair,
  to: PublicKey,
  amount: number
) {
  const transaction = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: amount,
    })
  );

  // Send the transaction
  const signature = await provider.sendAndConfirm(transaction, [from]);
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

export async function getLifafaData(
  program: anchor.Program<Lifafa>,
  id: number
) {
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
  claimMode: ClaimMode;
}

export enum ClaimMode {
  Random = 0,
  Equal = 1,
  None = 2
}

export function getTestData(): TestInputData {
  return {
    id: generateLifafaId(),
    timeLimit: 1000,
    maxClaims: 2,
    ownerName: "jovian",
    desc: "Gift for winning the hackathon",
    amount: 100 * 1e6,
    claimMode: ClaimMode.Random
  };
}
