import { BN } from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { RedEnvelope } from "../target/types/red_envelope";

const fs = require("fs");
const path = require("path");

const secretKey = JSON.parse(
  fs.readFileSync("/home/jovian/.config/solana/id.json", "utf8")
);
const wallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
console.log("Wallet loaded")

// Configure the client to use the local cluster
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.RedEnvelope as anchor.Program<RedEnvelope>;

async function printMyBalance(): Promise<number> {
  const balance = await provider.connection.getBalance(provider.wallet.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
  return balance;
}

async function printEnvelopeBalance(envelopeVault: any): Promise<number>{
  const envelopeBalance = await provider.connection.getBalance(envelopeVault);
  console.log(`Envelope balance: ${envelopeBalance / web3.LAMPORTS_PER_SOL} SOL`);
  return envelopeBalance;
}

async function confirmHash(txHash: any){
  console.log(`TRANSACTION CONFIRMED -> ${txHash}`);
  await provider.connection.confirmTransaction(txHash);
}

function toSol(amount: number): number {
  return amount / web3.LAMPORTS_PER_SOL;
}

console.log("Program Id:", program.programId)
console.log("My address:", provider.wallet.publicKey.toString());
printMyBalance();

const id = Math.floor(Math.random() * 10000000); //TODO: generate unique random id for each envelope
const amount = web3.LAMPORTS_PER_SOL * 0.1;
const timeLimit = 1000;
const [envelopeVault, envelopeVaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("envelopeVault", "utf8"),
    new BN(id).toArrayLike(Buffer, "le", 8),
  ],
  program.programId
);

async function createEnvelope() {
  console.log(`\nCreate Envelope, amount = ${toSol(amount)}, id = ${id}`);
  await printMyBalance();
  await printEnvelopeBalance(envelopeVault);
  const txHash = await program.methods
    .createEnvelope(
      new anchor.BN(id), 
      new anchor.BN(amount), 
      new anchor.BN(timeLimit),
      1,
      "jovian"
    )
    .accounts({
      envelope: envelopeVault,
      signer: provider.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([wallet]) // Assuming payer is the keypair used for transactions
    .rpc();
  await confirmHash(txHash);
  await printMyBalance();
  await printEnvelopeBalance(envelopeVault);
  console.log("Done creating envelope")
}

async function claimEnvelope() {
  console.log("\nClaiming Envelope");
  const myInitialBalance = await printMyBalance();
  await printEnvelopeBalance(envelopeVault);
  const txHash = await program.methods
    .claim(new anchor.BN(id))
    .accounts({
      envelope: envelopeVault,
      signer: provider.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([wallet])
    .rpc();
  await confirmHash(txHash);
  const myFinalBalance = await printMyBalance();
  await printEnvelopeBalance(envelopeVault);
  console.log(`Amount Claimed = ${toSol(myFinalBalance - myInitialBalance)}`);
}

async function deleteEnvelope() {
  console.log("\nDelete Envelope");
  const myInitialBalance = await printMyBalance();
  await printEnvelopeBalance(envelopeVault);
  const txHash = await program.methods
    .deleteEnvelope(new anchor.BN(id))
    .accounts({
      envelope: envelopeVault,
      signer: provider.wallet.publicKey,
    })
    .signers([wallet])
    .rpc();
  await confirmHash(txHash);
  const myFinalBalance = await printMyBalance();
  await printEnvelopeBalance(envelopeVault);
  console.log(`Amount Reclaimed from envelope vault = ${toSol(myFinalBalance - myInitialBalance)}`);
}

async function main(){
  await createEnvelope();
  await claimEnvelope();
  await claimEnvelope() // Should throw an error when claiming second time
  await deleteEnvelope();
}

main();

