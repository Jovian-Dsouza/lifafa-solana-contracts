pub use crate::errors::LifafaError;
use crate::{LIFAFA_SEED, Lifafa};

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::hash::hash;
use crate::xor_shift;

pub fn claim_sol_lifafa(ctx: Context<ClaimSolLifafa>, _id: u64) -> Result<()>  {
        let lifafa = &mut ctx.accounts.lifafa;

        let clock = Clock::get()?;
        let time_left = (lifafa.creation_time + lifafa.time_limit) - clock.unix_timestamp;
        if time_left <= 0 {
            return err!(LifafaError::TimeLimitExpired); // Time limit exceeded
        }

        // Check maximum claims limit
        if lifafa.claimed.len() as u16 >= lifafa.max_claims {
            return err!(LifafaError::MaxClaimsReached); 
        }

        // Check if the user has already claimed from this lifafa
        // Hash the claimant's public key and take the first 8 bytes
        let claimant_hash = {
            let hash = hash(&ctx.accounts.signer.key().to_bytes());
            let mut slice = [0u8; 8];
            slice.copy_from_slice(&hash.to_bytes()[..8]);
            slice
        };
        if lifafa.claimed.contains(&claimant_hash) {
            return err!(LifafaError::AlreadyClaimed);
        }

        // TODO use Oracle for Security - however cost of 0.002 SOL will be added
        // Pseudo random number - Uses timestamp, hash and xorshift
        let hash = hash(&clock.slot.to_be_bytes());
        let pseudo_random_number = xor_shift(u64::from_be_bytes(hash.to_bytes()[..8].try_into().unwrap()));

        let current_balance = ctx.accounts.lifafa.to_account_info().lamports();
        let max_withdrawable_balance = current_balance.saturating_sub(Rent::get()?.minimum_balance(8 + Lifafa::MAX_SIZE));
        
        let claim_amount =  pseudo_random_number % max_withdrawable_balance; // TODO random amount, between 0 and max withdrawable balance
        **ctx
            .accounts
            .lifafa
            .to_account_info()
            .try_borrow_mut_lamports()? -= claim_amount;
        **ctx
            .accounts
            .signer
            .to_account_info()
            .try_borrow_mut_lamports()? += claim_amount;

        ctx.accounts.lifafa.claimed.push(claimant_hash);

        msg!("Lifafa Claimed, Amount: {}", claim_amount);
        Ok(())
    }

#[derive(Accounts)]
#[instruction(_id : u64)]
pub struct ClaimSolLifafa<'info> {
    #[account(
        mut,
        seeds = [LIFAFA_SEED.as_bytes(), _id.to_le_bytes().as_ref()],
        bump
    )]
    pub lifafa: Account<'info, Lifafa>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}