import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import { Lifafa } from "../target/types/lifafa";
import {
  loadWallet,
  getBalance,
  createLifafa,
  claimLifafa,
  deleteLifafa,
  generateLifafaId,
  findLifafaState,
  toSol,
  confirmTransaction,
  createTokenMint,
  createTokenAccount,
  // transferSPLTokens
  getTokenBalance,
  createSplLifafa,
} from "../client/utils";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Test Red Envelope", () => {
  // Load wallet from the secret key path
  const secretKeyPath = "/home/jovian/.config/solana/id.json";
  let wallet: web3.Keypair;
  let wallet2: web3.Keypair;
  let provider: anchor.AnchorProvider;
  let program: anchor.Program<Lifafa>;

  before(async () => {
    wallet = await loadWallet(secretKeyPath);
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    program = anchor.workspace.Lifafa as anchor.Program<Lifafa>;
    wallet2 = web3.Keypair.generate();
  });

  // it("create sol lifafa", async () => {
  //   const id = Math.floor(Math.random() * 10000000);
  //   const amount = web3.LAMPORTS_PER_SOL * 0.1;
  //   const timeLimit = 1000;
  //   const maxClaims = 1;
  //   const ownerName = "jovian";
  //   const desc = "Gift"

  //   console.log(program.programId.toString())
  //   const [lifafaState] = findLifafaState(program.programId, id);

  //   await createLifafa(
  //       program,
  //       provider,
  //       wallet,
  //       id,
  //       amount,
  //       timeLimit,
  //       maxClaims,
  //       ownerName,
  //       desc,
  //       lifafaState
  //     );

  //   // Fetch the created lifafa account
  //   const createdLifafa = await program.account.lifafa.fetch(lifafaState);

  //   console.log("On-chain lifafa data:", {
  //     id: createdLifafa.id.toString(),
  //     amount: await getBalance(provider.connection, lifafaState),
  //     timeLimit: createdLifafa.timeLimit.toString(),
  //     maxClaims: createdLifafa.maxClaims,
  //     ownerName: createdLifafa.ownerName
  //   });

  //   // Check whether the data on-chain is equal to local data
  //   assert(id === createdLifafa.id.toNumber());
  //   // assert(amount === createdLifafa.amount.toNumber());
  //   assert(timeLimit === createdLifafa.timeLimit.toNumber());
  //   assert(maxClaims === createdLifafa.maxClaims.toNumber());
  //   assert(ownerName === createdLifafa.ownerName);
  // });

  // it("claim sol lifafa", async () => {
  //   // Create a new lifafa first
  //   const id = generateLifafaId();
  //   const amount = web3.LAMPORTS_PER_SOL * 0.1;
  //   const timeLimit = 1000;
  //   const maxClaims = 1;
  //   const ownerName = "jovian";
  //   const desc = "Gift"

  //   const [lifafaState] = findLifafaState(program.programId, id);

  //   console.log(`\nCreating Lifafa for claiming test, amount = ${toSol(amount)}, id = ${id}`);

  //   await createLifafa(
  //       program,
  //       provider,
  //       wallet,
  //       id,
  //       amount,
  //       timeLimit,
  //       maxClaims,
  //       ownerName,
  //       desc,
  //       lifafaState
  //     );

  //   // Initial balances before claiming
  //   const initialWalletBalance = await getBalance(provider.connection, provider.wallet.publicKey);
  //   const initialLifafaBalance = await getBalance(provider.connection, lifafaState);

  //   console.log(`Initial wallet balance: ${initialWalletBalance} SOL`);
  //   console.log(`Initial lifafa balance: ${initialLifafaBalance} SOL`);

  //   // Claim the lifafa
  //   await claimLifafa(program, provider, wallet, id, lifafaState);

  //   // Balances after claiming
  //   const finalWalletBalance = await getBalance(provider.connection, provider.wallet.publicKey);
  //   const finalLifafaBalance = await getBalance(provider.connection, lifafaState);

  //   console.log(`Final wallet balance: ${finalWalletBalance} SOL`);
  //   console.log(`Final lifafa balance: ${finalLifafaBalance} SOL`);

  //   // Check whether the balance was transferred correctly
  //   assert(finalWalletBalance > initialWalletBalance, "Wallet balance should increase after claiming the lifafa");
  //   assert(finalLifafaBalance < initialLifafaBalance, "Lifafa balance should decrease after being claimed");
  // });

  it("transfers SPL tokens", async () => {
    const id = generateLifafaId();
    const timeLimit = 1000;
    const maxClaims = 1;
    const ownerName = "jovian";
    const desc = "Gift";
    const giftAmount = 100;

    const [lifafaPDA] = findLifafaState(program.programId, id);

    console.log(
      `\nCreating Lifafa for claiming test, amount = ${giftAmount}, id = ${id}`
    );

    const mintAmount = 100000000
    const amount = new BN(web3.LAMPORTS_PER_SOL * 0.1); // Amount to transfer
    const mint = await createTokenMint(provider, wallet);
    console.log("Token mint: ", mint.toString());

    const ata = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet,
      mint,
      wallet.publicKey,
      false,
    )).address;
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
    console.log("From ata account: ", ata.toString());
    console.log("Vault account: ", vault.toString());
    console.log(
      `From account balance: ${await getTokenBalance(provider, ata)}`
    );
    console.log(
      `To account balance: ${await getTokenBalance(provider, vault)}`
    );
    const txHash = await program.methods
      .createSplLifafa(
        new anchor.BN(id),
        new anchor.BN(amount),
        new anchor.BN(timeLimit),
        new anchor.BN(maxClaims),
        ownerName,
        desc
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

    // const fromBalance = await getTokenBalance(provider, fromTokenAccount);
    // const toBalance = await getTokenBalance(provider, toTokenAccount);

    console.log(
      `From account balance: ${await getTokenBalance(provider, ata)}`
    );
    console.log(
      `To account balance: ${await getTokenBalance(provider, vault)}`
    );

    console.log("\nClaiming Lifafa");
    const txHash2 = await program.methods
      .claimSplLifafa(new anchor.BN(id))
      .accounts({
        mint: mint,
        vault: vault,
        signer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();
    await confirmTransaction(provider.connection, txHash2);

    console.log(
      `From account balance: ${await getTokenBalance(provider, ata)}`
    );
    console.log(
      `To account balance: ${await getTokenBalance(provider, vault)}`
    );

    // assert.strictEqual(
    //   fromBalance,
    //   0,
    //   "From account should have 0 tokens left"
    // );
    // assert.strictEqual(
    //   toBalance,
    //   amount.toNumber(),
    //   "To account should have received the tokens"
    // );
  });
});
