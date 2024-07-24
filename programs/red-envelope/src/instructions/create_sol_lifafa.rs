pub use crate::errors::LifafaError;
use crate::{ MAX_OWNER_NAME, MAX_DESC, LIFAFA_SEED, Lifafa, ClaimMode};

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::clock::Clock;

pub fn create_sol_lifafa(
    ctx: Context<CreateSolLifafa>,
    id: u64,
    amount: u64, //In lamports
    time_limit_in_seconds: i64,
    max_claims: u64,
    owner_name: String,
    desc: String,
    claim_mode: ClaimMode, 
) -> Result<()>  {
    require!(
        owner_name.len() as u16 <= MAX_OWNER_NAME,
        LifafaError::OwnerNameTooLong
    );
    require!(
        desc.len() as u16 <= MAX_DESC,
        LifafaError::DescriptionTooLong
    );
    ctx.accounts.lifafa.id = id;
    ctx.accounts.lifafa.creation_time = Clock::get()?.unix_timestamp;
    ctx.accounts.lifafa.time_limit = time_limit_in_seconds;
    ctx.accounts.lifafa.owner = ctx.accounts.signer.key();
    ctx.accounts.lifafa.owner_name = owner_name;
    ctx.accounts.lifafa.claims = 0;
    ctx.accounts.lifafa.max_claims = max_claims;
    ctx.accounts.lifafa.amount = amount;
    ctx.accounts.lifafa.desc = desc;
    ctx.accounts.lifafa.claim_mode = claim_mode;

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.signer.to_account_info().clone(),
            to: ctx.accounts.lifafa.to_account_info().clone(),
        },
    );
    system_program::transfer(cpi_context, amount)?;
    Ok(())
}

#[derive(Accounts)]
#[instruction(id : u64)]
pub struct CreateSolLifafa<'info> {
    #[account(
        init_if_needed,
        seeds = [LIFAFA_SEED.as_bytes(), id.to_le_bytes().as_ref()],
        bump,
        payer = signer,
        space = 8 + Lifafa::INIT_SPACE
    )]
    pub lifafa: Account<'info, Lifafa>,

    
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}