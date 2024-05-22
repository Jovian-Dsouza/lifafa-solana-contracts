import * as fs from 'fs';
import * as anchor from "@coral-xyz/anchor";
import { web3, BN } from "@coral-xyz/anchor";
import type { Lifafa } from "../target/types/lifafa";

const LIFAFA_SEED = "lifafa";

export async function loadWallet(secretKeyPath: string): Promise<web3.Keypair> {
  const secretKey = JSON.parse(fs.readFileSync(secretKeyPath, "utf8"));
  return web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
}
 
export async function getBalance(connection: web3.Connection, publicKey: web3.PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / web3.LAMPORTS_PER_SOL;
}

export async function confirmTransaction(connection: web3.Connection, txHash: string) {
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
    lifafaState: web3.PublicKey, 
) {
  console.log(`\nCreate Lifafa, amount = ${toSol(amount)}, id = ${id}`);
  const txHash = await program.methods
    .createSolLifafa(
      new anchor.BN(id),
      new anchor.BN(amount),
      new anchor.BN(timeLimit),
      maxClaims,
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

export async function claimLifafa(program: anchor.Program<Lifafa>, provider: anchor.AnchorProvider, wallet: web3.Keypair, id: number, lifafaState: web3.PublicKey) {
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

export async function deleteLifafa(program: anchor.Program<Lifafa>, provider: anchor.AnchorProvider, wallet: web3.Keypair, id: number, lifafaState: web3.PublicKey) {
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

export function findLifafaState(programId: web3.PublicKey, id: number): [web3.PublicKey, number] {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(LIFAFA_SEED, "utf8"),
      new BN(id).toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}
