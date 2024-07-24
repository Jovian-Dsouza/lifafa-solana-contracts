import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import { Lifafa } from "../target/types/lifafa";
import {
  loadWallet,
  findLifafaState,
  getTokenBalance,
  createSplLifafa,
  getRequiredATA,
  claimSplLifafa,
  getATABalances,
  getTestData,
  deleteSplLifafa,
  getLifafaData,
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
  });

  it("Create spl lifafa", async () => {
    const testData = getTestData();

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    const [ataBalInit, vaultBalInit] = await getATABalances(
      provider,
      ata,
      vault,
      false
    );
    await createSplLifafa(provider, program, wallet, testData, mint, vault);
    const [ataCreateBal, vaultCreateBal] = await getATABalances(
      provider,
      ata,
      vault,
      false
    );
    const lifafaData = await getLifafaData(program, testData.id);
    assert(lifafaData.id.toNumber() == testData.id);
    assert(lifafaData.timeLimit.toNumber() == testData.timeLimit);
    assert(lifafaData.claims.toNumber() == 0);
    assert(lifafaData.maxClaims.toNumber() === testData.maxClaims);
    assert(lifafaData.ownerName === testData.ownerName);
    assert(lifafaData.owner.toString() === wallet.publicKey.toString());
    assert(lifafaData.mintOfTokenBeingSent.toString() === mint.toString());
    assert(lifafaData.amount.toNumber() === testData.amount);
    assert(lifafaData.desc === testData.desc);
    assert(vaultCreateBal.toNumber() === testData.amount);

    // Attempt to create lifafa with the same ID and expect it to fail
    let error = null;
    try {
      await createSplLifafa(provider, program, wallet, testData, mint, vault);
    } catch (err) {
      error = err;
    }

    assert(
      error && error.error.errorCode.code === "LifafaAlreadyExists",
      "Expected error when creating lifafa with duplicate ID"
    );

  });

  // it("create, claim, delete SPL tokens", async () => {
  //   const testData = getTestData();

  //   const [lifafaPDA] = findLifafaState(program.programId, testData.id);
  //   const [mint, ata, vault] = await getRequiredATA(
  //     provider,
  //     wallet,
  //     lifafaPDA
  //   );
  //   console.log(
  //     `\nCreating SPL Lifafa, amount = ${testData.amount}, id = ${testData.id}`
  //   );
  //   await createSplLifafa(provider, program, wallet, testData, mint, vault);
  //   const [ataCreateBal, vaultCreateBal] = await getATABalances(
  //     provider,
  //     ata,
  //     vault,
  //     true
  //   );

  //   await claimSplLifafa(provider, program, wallet, testData.id, mint, vault);
  //   await getATABalances(provider, ata, vault, true);

  //   await deleteSplLifafa(provider, program, wallet, testData.id, mint, vault)

  //   console.log(
  //     `From account balance: ${await getTokenBalance(provider, ata)}`
  //   );
  //   // assert.strictEqual(
  //   //   fromBalance,
  //   //   0,
  //   //   "From account should have 0 tokens left"
  //   // );
  //   // assert.strictEqual(
  //   //   toBalance,
  //   //   amount.toNumber(),
  //   //   "To account should have received the tokens"
  //   // );
  // });
});
