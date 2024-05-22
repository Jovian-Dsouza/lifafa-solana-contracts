pub use crate::errors::LifafaError;
use crate::{ LIFAFA_SEED, Lifafa};

use anchor_lang::prelude::*;

pub fn delete_sol_lifafa(ctx: Context<DeleteSolLifafa>, _id: u64) -> Result<()> {      
    if ctx.accounts.lifafa.owner != ctx.accounts.signer.key() {
        return err!(LifafaError::Unauthorized); 
    }

    // Transfer all funds from the lifafa back to the owner
    let balance = ctx.accounts.lifafa.to_account_info().lamports();
    msg!("Lifafa Deleted, Amount Returned: {}", balance);
    Ok(())
}

#[derive(Accounts)]
#[instruction(_id : u64)]
pub struct DeleteSolLifafa<'info> {
    #[account(
        mut,
        close = signer,
        seeds = [LIFAFA_SEED.as_bytes(), _id.to_le_bytes().as_ref()],
        bump
    )]
    pub lifafa: Account<'info, Lifafa>,

    #[account(mut)]
    pub signer: Signer<'info>,
}
