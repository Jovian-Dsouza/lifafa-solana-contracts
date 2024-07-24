pub use crate::errors::LifafaError;
use crate::{LIFAFA_SEED, Lifafa, UserClaim, ClaimMode};

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::hash::hash;
use crate::xor_shift;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};


pub fn claim_spl_lifafa(ctx: Context<ClaimSplLifafa>, _id: u64) -> Result<()>  {
    let user_claim = &mut ctx.accounts.user_claim;

    let clock = Clock::get()?;
    let time_left = (ctx.accounts.lifafa.creation_time + ctx.accounts.lifafa.time_limit) - clock.unix_timestamp;
    if time_left <= 0 {
        return err!(LifafaError::TimeLimitExpired); // Time limit exceeded
    }

    // Check maximum claims limit
    if ctx.accounts.lifafa.claims >= ctx.accounts.lifafa.max_claims {
        return err!(LifafaError::MaxClaimsReached); 
    }

    if user_claim.claimed == true {
        return err!(LifafaError::AlreadyClaimed);
    }

    // Calculate claim amount based on the claim mode
    let claim_amount = match ctx.accounts.lifafa.claim_mode {
        ClaimMode::Random => {
            let hash = hash(&clock.slot.to_be_bytes());
            let pseudo_random_number = xor_shift(u64::from_be_bytes(hash.to_bytes()[..8].try_into().unwrap()));
            pseudo_random_number % ctx.accounts.vault.amount
        }
        ClaimMode::Equal => {
            ctx.accounts.vault.amount / ctx.accounts.lifafa.max_claims
        }
    };
    
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.ata.to_account_info(),
        authority: ctx.accounts.lifafa.to_account_info(),
    };

    let seeds: [&[&[u8]]; 1] = [&[LIFAFA_SEED.as_bytes(), &_id.to_le_bytes(), &[ctx.accounts.lifafa.bump]]];
    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_accounts, &seeds);
    let _ = transfer_checked(cpi_ctx, claim_amount, ctx.accounts.mint.decimals)?;

    ctx.accounts.lifafa.claims += 1;
    user_claim.claimed = true;
    user_claim.amount_claimed = claim_amount;

    msg!("Lifafa Claimed, Amount: {}", claim_amount);
    Ok(())
}

#[derive(Accounts)]
#[instruction(_id : u64)]
pub struct ClaimSplLifafa<'info> {
    #[account(
        mut,
        seeds = [LIFAFA_SEED.as_bytes(), _id.to_le_bytes().as_ref()],
        bump = lifafa.bump
    )]
    pub lifafa: Account<'info, Lifafa>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program
    )]
    pub ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
            init_if_needed, 
            payer = signer, 
            space = 8 + UserClaim::INIT_SPACE,
            seeds = [
                b"user_claim", 
                lifafa.key().as_ref(),
                signer.key().as_ref(),
            ],
            bump,
        )]
    pub user_claim: Account<'info, UserClaim>,


    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}