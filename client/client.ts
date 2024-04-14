import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { RedEnvelope } from "../target/types/red_envelope";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.RedEnvelope as anchor.Program<RedEnvelope>;


async function printMyBalance(): Promise<number> {
  const balance = await pg.connection.getBalance(pg.wallet.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
  return balance;
}

async function printEnvelopBalance(envelopeVault: any): Promise<number>{
  const envelopBalance = await pg.connection.getBalance(envelopeVault);
  console.log(`Envelope balance: ${envelopBalance / web3.LAMPORTS_PER_SOL} SOL`);
  return envelopBalance;
}

async function confirmHash(txHash: any){
  console.log(`TRANSACTION CONFIRMED -> ${txHash}`);
  await pg.connection.confirmTransaction(txHash);
}

function toSol(amount: number): number{
  return amount / web3.LAMPORTS_PER_SOL;
}


console.log("My address:", pg.wallet.publicKey.toString());
await printMyBalance()

const id = 2; //TODO: generate unique random id for each envelope
const amount = web3.LAMPORTS_PER_SOL * 0.1
const timeLimit = 1000;
const [envelopeVault, envelopeVaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("envelopeVault", "utf8"),
      new BN(id).toArrayLike(Buffer, "le", 8),
    ],
    pg.program.programId
  );

async function createEnvelope(){
  console.log(`\nCreate Envelope, amount = ${toSol(amount)}, id = ${id}`)
  await printMyBalance();
  await printEnvelopBalance(envelopeVault);
  const txHash = await pg.program.methods
    .createEnvelope(new anchor.BN(id), new anchor.BN(amount), new anchor.BN(timeLimit))
    .accounts({
      envelope: envelopeVault,
      signer: pg.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([pg.wallet.keypair])
    .rpc();
  await confirmHash(txHash)
  await printMyBalance();
  await printEnvelopBalance(envelopeVault);
}

async function claimEnvelope(){
  console.log("\nClaiming Envelope")
  const myInitalBalance = await printMyBalance();
  await printEnvelopBalance(envelopeVault);
  const txHash = await pg.program.methods
    .claim(new anchor.BN(id))
    .accounts({
      envelope: envelopeVault,
      signer: pg.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([pg.wallet.keypair])
    .rpc();
  await confirmHash(txHash)
  const myFinalBalance = await printMyBalance();
  await printEnvelopBalance(envelopeVault);
  console.log(`Amount Claimed = ${toSol(myFinalBalance-myInitalBalance)}`)
}

async function deleteEnvelope() {
  console.log("\nDelete Envelope")
  const myInitalBalance = await printMyBalance();
  await printEnvelopBalance(envelopeVault);
  const txHash = await pg.program.methods
    .deleteEnvelope(new anchor.BN(id))
    .accounts({
      envelope: envelopeVault,
      signer: pg.wallet.publicKey,
    })
    .signers([pg.wallet.keypair])
    .rpc();
  await confirmHash(txHash)
  const myFinalBalance = await printMyBalance();
  await printEnvelopBalance(envelopeVault);
  console.log(`Amount Reclaimed from envelope vault = ${toSol(myFinalBalance-myInitalBalance)}`)
}

await createEnvelope()
await claimEnvelope()
// await claimEnvelope() // Shoudld throw an error when claiming second tim
await deleteEnvelope()
