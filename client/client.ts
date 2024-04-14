import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { RedEnvelope } from "../target/types/red_envelope";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.RedEnvelope as anchor.Program<RedEnvelope>;


async function printMyBalance(){
  const balance = await program.provider.connection.getBalance(program.provider.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
}

async function printEnvelopBalance(envelopeVault: any){
  const envelopBalance = await program.provider.connection.getBalance(envelopeVault);
  console.log(`Envelope balance: ${envelopBalance / web3.LAMPORTS_PER_SOL} SOL`);
}

async function confirmHash(txHash: any){
  console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
  await program.provider.connection.confirmTransaction(txHash);
}


console.log("My address:", program.provider.publicKey.toString());
await printMyBalance()

let txHash;
const id = 1; //TODO: generate unique random id for each envelope
const amount = web3.LAMPORTS_PER_SOL * 0.01
const timeLimit = 1000

const [envelopeVault, envelopeVaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("envelopeVault", "utf8"),
      new BN(id).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

console.log("\nCreate Envelope")
await printEnvelopBalance(envelopeVault);
txHash = await program.methods
  .createEnvelope(new anchor.BN(id), new anchor.BN(amount), new anchor.BN(timeLimit))
  .accounts({
    envelope: envelopeVault,
    signer: program.provider.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
  .signers([program.provider.wallet.payer])
  .rpc();
await confirmHash(txHash)

console.log("\nClaiming Envelope")
await printMyBalance();
await printEnvelopBalance(envelopeVault);
txHash = await program.methods
  .claim(new anchor.BN(id))
  .accounts({
    envelope: envelopeVault,
    signer: program.provider.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
  .signers([program.provider.wallet.payer])
  .rpc();
await confirmHash(txHash)
await printMyBalance();
await printEnvelopBalance(envelopeVault);

console.log("\nDelete Envelope")
await printMyBalance();
await printEnvelopBalance(envelopeVault);
txHash = await program.methods
  .deleteEnvelope(new anchor.BN(id))
  .accounts({
    envelope: envelopeVault,
    signer: program.provider.publicKey,
  })
  .signers([program.provider.wallet.payer])
  .rpc();
await confirmHash(txHash)
await printMyBalance();
await printEnvelopBalance(envelopeVault);