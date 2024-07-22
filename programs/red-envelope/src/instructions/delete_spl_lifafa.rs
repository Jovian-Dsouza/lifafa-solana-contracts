pub use crate::errors::LifafaError;
use crate::{ LIFAFA_SEED, Lifafa};

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

pub fn delete_spl_lifafa(ctx: Context<DeleteSplLifafa>, _id: u64) -> Result<()> {      
    if ctx.accounts.lifafa.owner != ctx.accounts.signer.key() {
        return err!(LifafaError::Unauthorized); 
    }

    let seeds: [&[&[u8]]; 1] = [&[LIFAFA_SEED.as_bytes(), &_id.to_le_bytes(), &[ctx.accounts.lifafa.bump]]];

    // Transfer all funds from the vault back to the owner
    let balance = ctx.accounts.vault.amount;

    if balance > 0 {
        let transfer_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.ata.to_account_info(),
            authority: ctx.accounts.lifafa.to_account_info(), // Authority is the lifafa account
        };

        let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_accounts, &seeds);

        transfer_checked(cpi_ctx, balance, ctx.accounts.mint.decimals)?;
    }

    // Close the vault account
    let close_accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.signer.to_account_info(),
        authority: ctx.accounts.lifafa.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), close_accounts, &seeds);
    close_account(cpi_ctx)?;

    // Transfer all funds from the lifafa back to the owner
    // let balance = ctx.accounts.lifafa.to_account_info().lamports();
    // msg!("Lifafa Deleted, Amount Returned: {}", balance);
    Ok(())
}

#[derive(Accounts)]
#[instruction(_id : u64)]
pub struct DeleteSplLifafa<'info> {
    #[account(
        mut,
        close = signer,
        seeds = [LIFAFA_SEED.as_bytes(), _id.to_le_bytes().as_ref()],
        bump
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


    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
