use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::hash::hash;

declare_id!("58chdRkNN8RN72jSyUGnwcN8nhUVrHcZrHEGpcYF6Jsz");

pub const MAX_CLAIMS_ALLOWED: u16 = 1000; 
pub const MAX_OWNER_NAME: u16 = 32; 
pub const ENVELOPE_SEED: &str = "envelopeVault";

fn xor_shift(mut seed: u64) -> u64 {
    seed ^= seed << 12;
    seed ^= seed >> 25;
    seed ^= seed << 27;
    seed = (seed as u128 * 0x2545F4914F6CDD1D) as u64;
    return seed;
}
    
#[program]
mod red_envelope {
    use super::*;

    #[error_code]
    pub enum MyError {
        #[msg("TimeLimit has expired")]
        TimeLimitExpired,

        #[msg("Unauthorized")]
        Unauthorized,

        #[msg("Already claimed")]
        AlreadyClaimed,

        #[msg("Max Claims Reached")]
        MaxClaimsReached,

        #[msg("Max claims limit exceeded")]
        MaxClaimsLimitExceeded,

        #[msg("Owner name too long")]
        OwnerNameTooLong,
    }
    
    pub fn create_envelope(
        ctx: Context<CreateEnvelope>,
        id: u64,
        amount: u64, //In lamports
        time_limit_in_seconds: i64,
        max_claims: u16,
        owner_name: String,
    ) -> Result<()>  {
        require!(
            owner_name.len() as u16 <= MAX_OWNER_NAME,
            MyError::OwnerNameTooLong
        );
        require!(max_claims <= MAX_CLAIMS_ALLOWED, MyError::MaxClaimsLimitExceeded);
        ctx.accounts.envelope.id = id;
        ctx.accounts.envelope.creation_time = Clock::get()?.unix_timestamp;
        ctx.accounts.envelope.time_limit = time_limit_in_seconds;
        ctx.accounts.envelope.owner = ctx.accounts.signer.key();
        ctx.accounts.envelope.max_claims = max_claims;
        ctx.accounts.envelope.owner_name = owner_name;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.signer.to_account_info().clone(),
                to: ctx.accounts.envelope.to_account_info().clone(),
            },
        );
        system_program::transfer(cpi_context, amount)?;
        msg!("Envelope Created with ID: {}", id);

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>, _id: u64) -> Result<()>  {
        let envelope = &mut ctx.accounts.envelope;

        let clock = Clock::get()?;
        let time_left = (envelope.creation_time + envelope.time_limit) - clock.unix_timestamp;
        if time_left <= 0 {
            return err!(MyError::TimeLimitExpired); // Time limit exceeded
        }

        // Check maximum claims limit
        if envelope.claimed.len() as u16 >= envelope.max_claims {
            return err!(MyError::MaxClaimsReached); 
        }

        // Check if the user has already claimed from this envelope
        // Hash the claimant's public key and take the first 8 bytes
        let claimant_hash = {
            let hash = hash(&ctx.accounts.signer.key().to_bytes());
            let mut slice = [0u8; 8];
            slice.copy_from_slice(&hash.to_bytes()[..8]);
            slice
        };
        if envelope.claimed.contains(&claimant_hash) {
            return err!(MyError::AlreadyClaimed);
        }

        // TODO use Oracle for Security - however cost of 0.002 SOL will be added
        // Pseudo random number - Uses timestamp, hash and xorshift
        let hash = hash(&clock.slot.to_be_bytes());
        let pseudo_random_number = xor_shift(u64::from_be_bytes(hash.to_bytes()[..8].try_into().unwrap()));

        let current_balance = ctx.accounts.envelope.to_account_info().lamports();
        let max_withdrawable_balance = current_balance.saturating_sub(Rent::get()?.minimum_balance(8 + Envelope::MAX_SIZE));
        
        let claim_amount =  pseudo_random_number % max_withdrawable_balance; // TODO random amount, between 0 and max withdrawable balance
        **ctx
            .accounts
            .envelope
            .to_account_info()
            .try_borrow_mut_lamports()? -= claim_amount;
        **ctx
            .accounts
            .signer
            .to_account_info()
            .try_borrow_mut_lamports()? += claim_amount;

        ctx.accounts.envelope.claimed.push(claimant_hash);

        msg!("Envelope Claimed, Amount: {}", claim_amount);
        Ok(())
    }

    pub fn delete_envelope(ctx: Context<DeleteEnvelope>, _id: u64) -> Result<()> {      
        if ctx.accounts.envelope.owner != ctx.accounts.signer.key() {
            return err!(MyError::Unauthorized); 
        }

        // Transfer all funds from the envelope back to the owner
        let balance = ctx.accounts.envelope.to_account_info().lamports();
        msg!("Envelope Deleted, Amount Returned: {}", balance);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(id : u64)]
pub struct CreateEnvelope<'info> {
    #[account(
        init_if_needed,
        seeds = [ENVELOPE_SEED.as_bytes(), id.to_le_bytes().as_ref()],
        bump,
        payer = signer,
        space = 8 + Envelope::MAX_SIZE
    )]
    pub envelope: Account<'info, Envelope>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_id : u64)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [ENVELOPE_SEED.as_bytes(), _id.to_le_bytes().as_ref()],
        bump
    )]
    pub envelope: Account<'info, Envelope>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_id : u64)]
pub struct DeleteEnvelope<'info> {
    #[account(
        mut,
        close = signer,
        seeds = [ENVELOPE_SEED.as_bytes(), _id.to_le_bytes().as_ref()],
        bump
    )]
    pub envelope: Account<'info, Envelope>,

    #[account(mut)]
    pub signer: Signer<'info>,
}

#[account]
pub struct Envelope {
    pub id: u64,
    pub creation_time: i64,
    pub time_limit: i64,
    pub owner: Pubkey,
    pub owner_name: String,
    pub claimed: Vec<[u8; 8]>, // Stores the first 8 bytes of the hash of the claimant's public key
    pub max_claims: u16,
}

impl Envelope {
    pub const MAX_SIZE: usize = 8 + 8 + 8 + 32 + MAX_OWNER_NAME as usize + 4+(MAX_CLAIMS_ALLOWED as usize * 8) + 4;
}