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
  createTestWallet,
  ClaimMode,
} from "../client/utils";

describe("Test Red Envelope", () => {
  // Load wallet from the secret key path
  const secretKeyPath = "/home/jovian/.config/solana/id.json";
  let wallet: web3.Keypair;
  let provider: anchor.AnchorProvider;
  let program: anchor.Program<Lifafa>;

  before(async () => {
    wallet = await loadWallet(secretKeyPath);
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    program = anchor.workspace.Lifafa as anchor.Program<Lifafa>;
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

  it("Create & Claim spl lifafa (Random)", async () => {
    const testData = getTestData();

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    await createSplLifafa(provider, program, wallet, testData, mint, vault);
    const [ataCreateBal, vaultCreateBal] = await getATABalances(
      provider,
      ata,
      vault,
      true
    );
    await claimSplLifafa(provider, program, wallet, testData.id, mint, vault);
    const [ataClaimBal, vaultClaimBal] = await getATABalances(
      provider,
      ata,
      vault,
      true
    );

    const claimBal = ataClaimBal.sub(ataCreateBal).toNumber();
    assert(
      claimBal > 0 && claimBal <= testData.amount,
      "Claimed balance should be in valid range"
    );
    console.log("Claim Balance: ", claimBal.toString());

    // Attempt to claim lifafa with the same ID and expect it to fail
    let error = null;
    try {
      await claimSplLifafa(provider, program, wallet, testData.id, mint, vault);
    } catch (err) {
      error = err;
    }
    assert(
      error && error.error.errorCode.code === "AlreadyClaimed",
      "Expected error when claiming lifafa again"
    );

    // Different account should be able to claim
    const [wallet2, ata2] = await createTestWallet(provider, wallet, mint);
    await claimSplLifafa(provider, program, wallet2, testData.id, mint, vault);
    const claimed2 = await getTokenBalance(provider, ata2);
    console.log("Second wallet claimed", claimed2.toNumber());
    assert(
      claimed2.toNumber() > 0,
      "Second wallet should get a non zero value"
    );
    assert(
      claimBal + claimed2.toNumber() < testData.amount,
      "should not cross vault amount"
    );

    const _ = await getATABalances(provider, ata, vault, true);
    // Not allow more claims then Max claims

    error = null;
    try {
      const [wallet3, ata3] = await createTestWallet(provider, wallet, mint);
      await claimSplLifafa(
        provider,
        program,
        wallet3,
        testData.id,
        mint,
        vault
      );
    } catch (err) {
      error = err;
    }
    assert(
      error && error.error.errorCode.code === "MaxClaimsReached",
      "Expected error when claiming lifafa again"
    );
  });

  it("Create & Claim spl lifafa (Equal)", async () => {
    let testData = getTestData();
    testData.claimMode = ClaimMode.Equal;

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    await createSplLifafa(provider, program, wallet, testData, mint, vault);
    const [ataCreateBal, vaultCreateBal] = await getATABalances(
      provider,
      ata,
      vault,
      true
    );
    await claimSplLifafa(provider, program, wallet, testData.id, mint, vault);
    const [ataClaimBal, vaultClaimBal] = await getATABalances(
      provider,
      ata,
      vault,
      true
    );

    const claimBal = ataClaimBal.sub(ataCreateBal).toNumber();
    console.log("Claim Balance: ", claimBal.toString());
    assert(
      claimBal === testData.amount / testData.maxClaims,
      "Claimed balance should be equally devided"
    );

    // Different account should be able to claim
    const [wallet2, ata2] = await createTestWallet(provider, wallet, mint);
    await claimSplLifafa(provider, program, wallet2, testData.id, mint, vault);
    const claimed2 = await getTokenBalance(provider, ata2);
    console.log("Second wallet claimed", claimed2.toNumber());
    assert(
      claimed2.toNumber() === testData.amount / testData.maxClaims,
      "Claimed balance should be equally devided for second user"
    );
  });

  it("Create spl lifafa for claim mode (None) should fail", async () => {
    let testData = getTestData();
    testData.claimMode = ClaimMode.None;

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    let error = null;
    try {
      await createSplLifafa(provider, program, wallet, testData, mint, vault);
    } catch (err) {
      error = err;
    }
    assert(
      error && error.error.errorCode.code === "InvalidClaimMode",
      "Expected error when creating lifafa with invalid claim mode"
    );
  });

  it("create and delete SPL tokens", async () => {
    const testData = getTestData();

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    console.log(
      `\nCreating SPL Lifafa, amount = ${testData.amount}, id = ${testData.id}`
    );
    await createSplLifafa(provider, program, wallet, testData, mint, vault);
    const [ataCreateBal, vaultCreateBal] = await getATABalances(
      provider,
      ata,
      vault,
      true
    );

    await deleteSplLifafa(provider, program, wallet, testData.id, mint, vault);
    const ataDeleteBal = await getTokenBalance(provider, ata);
    console.log(`token account balance: ${ataDeleteBal}`);

    assert(
      ataCreateBal.add(vaultCreateBal).toString() === ataDeleteBal.toString(),
      "Final delete balance not matching"
    );

    // Attempt to read vault balance & expect it to fail
    let error = null;
    try {
      const vaultDeleteBal = await getTokenBalance(provider, vault);
      assert(true, "Vault ata should be deleted");
    } catch (err) {
      error = err;
    }
  });

  it("Only owner can delete the vault", async () => {
    const testData = getTestData();

    const [lifafaPDA] = findLifafaState(program.programId, testData.id);
    const [mint, ata, vault] = await getRequiredATA(
      provider,
      wallet,
      lifafaPDA
    );
    await createSplLifafa(provider, program, wallet, testData, mint, vault);
    const [ataCreateBal, vaultCreateBal] = await getATABalances(
      provider,
      ata,
      vault,
      false
    );

    const [wallet2, ata2] = await createTestWallet(provider, wallet, mint);

    // Attempt to read vault balance & expect it to fail
    let error = null;
    try {
      await deleteSplLifafa(
        provider,
        program,
        wallet2,
        testData.id,
        mint,
        vault
      );
    } catch (err) {
      error = err;
    }
    assert(error !== null, "Expected only owner can delete the vault");
  });
});
