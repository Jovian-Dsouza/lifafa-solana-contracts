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
  // transferSPLTokens
  getTokenBalance,
  createSplLifafa,
  getRequiredATA,
  claimSplLifafa,
  getATABalances,
  getTestData,
} from "../client/utils";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

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

    // const privateKey = bs58.encode(wallet.secretKey);
    // console.log(`Wallet PrivateKey:`, privateKey);
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

  //     await createLifafa(
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

  it("create, claim, delete SPL tokens", async () => {
    const testData = getTestData()

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    console.log(
      `\nCreating SPL Lifafa, amount = ${testData.amount}, id = ${testData.id}`
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
    const [ataCreateBal, vaultCreateBal] = await getATABalances(provider, ata, vault, true);

    await claimSplLifafa(provider, program, wallet, testData.id, mint, vault);
    await getATABalances(provider, ata, vault, true);

    console.log("\nDelete Lifafa");
    const txHash3 = await program.methods
      .deleteSplLifafa(new anchor.BN(testData.id))
      .accounts({
        mint: mint,
        vault: vault,
        signer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();
    await confirmTransaction(provider.connection, txHash3);

    console.log(
      `From account balance: ${await getTokenBalance(provider, ata)}`
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
