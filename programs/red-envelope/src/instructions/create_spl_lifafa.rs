pub use crate::errors::LifafaError;
use crate::{ MAX_OWNER_NAME, MAX_DESC, LIFAFA_SEED, Lifafa, ClaimMode};

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::clock::Clock;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};


pub fn create_spl_lifafa(
    ctx: Context<CreateSplLifafa>,
    id: u64,
    amount: u64, //In lamports
    time_limit_in_seconds: i64,
    max_claims: u64,
    owner_name: String,
    desc: String,
    claim_mode: u8,
) -> Result<()>  {
    // Convert and validate claim_mode
    let claim_mode = ClaimMode::from_u8(claim_mode)?;
    // Check if the Lifafa account is already initialized
    require!(
        ctx.accounts.lifafa.owner == Pubkey::default(),
        LifafaError::LifafaAlreadyExists
    );
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
    ctx.accounts.lifafa.max_claims = max_claims;
    ctx.accounts.lifafa.amount = amount;
    ctx.accounts.lifafa.desc = desc;
    ctx.accounts.lifafa.bump = ctx.bumps.lifafa;
    ctx.accounts.lifafa.mint_of_token_being_sent = ctx.accounts.mint.key();
    ctx.accounts.lifafa.claim_mode = claim_mode;

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)
}

#[derive(Accounts)]
#[instruction(id : u64)]
pub struct CreateSplLifafa<'info> {
    #[account(
        init_if_needed,
        seeds = [LIFAFA_SEED.as_bytes(), id.to_le_bytes().as_ref()],
        bump,
        payer = signer,
        space = 8 + Lifafa::INIT_SPACE
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

    // #[account(
    //     init_if_needed,
    //     payer = signer,
    //     associated_token::mint = mint,
    //     associated_token::authority =  lifafa,
    //     associated_token::token_program = token_program
    // )]
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}