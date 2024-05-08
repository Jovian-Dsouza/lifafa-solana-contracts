use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::hash::hash;

declare_id!("4pNnBsmfPeTGKQuU1VkfXGkcAspo8xQTfCffn5RHKNAv");

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
    }
    
    pub fn create_envelope(
        ctx: Context<CreateEnvelope>,
        id: u64,
        amount: u64, //In lamports
        time_limit_in_seconds: i64,
    ) -> Result<()>  {
        ctx.accounts.envelope.id = id;
        ctx.accounts.envelope.creation_time = Clock::get()?.unix_timestamp;
        ctx.accounts.envelope.time_limit = time_limit_in_seconds;
        ctx.accounts.envelope.owner = ctx.accounts.signer.key();

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

    pub fn claim(ctx: Context<Claim>, id: u64) -> Result<()>  {
        let envelope = &mut ctx.accounts.envelope;

        // Check if the user has already claimed from this envelope
        if envelope.claimed.contains(&ctx.accounts.signer.key()) {
            return err!(MyError::AlreadyClaimed);
        }

        let time_left = (envelope.creation_time + envelope.time_limit) - Clock::get()?.unix_timestamp;
        if time_left <= 0 {
            return err!(MyError::TimeLimitExpired); // Time limit exceeded
        }
        let current_balance = ctx.accounts.envelope.to_account_info().lamports();
        let max_withdrawable_balance = current_balance.saturating_sub(Rent::get()?.minimum_balance(8 + Envelope::MAX_SIZE));

        // Pseudo random number - TODO use Oracle for Security
        let clock = Clock::get()?;
        let pseudo_random_number = ((u64::from_le_bytes(
            <[u8; 8]>::try_from(&hash(&clock.unix_timestamp.to_be_bytes()).to_bytes()[..8])
            .unwrap(),
        ) * clock.slot)
            % u32::MAX as u64) as u64;
        
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

        ctx.accounts.envelope.claimed.push(ctx.accounts.signer.key());

        msg!("Envelope Claimed, Amount: {}", claim_amount);
        Ok(())
    }

    pub fn delete_envelope(ctx: Context<DeleteEnvelope>, id: u64) -> Result<()> {      
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
        seeds = [b"envelopeVault", id.to_le_bytes().as_ref()],
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
#[instruction(id : u64)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"envelopeVault", id.to_le_bytes().as_ref()],
        bump
    )]
    pub envelope: Account<'info, Envelope>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id : u64)]
pub struct DeleteEnvelope<'info> {
    #[account(
        mut,
        close = signer,
        seeds = [b"envelopeVault", id.to_le_bytes().as_ref()],
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
    pub claimed: Vec<Pubkey>,
}

impl Envelope {
    pub const MAX_SIZE: usize = 8 + 8 + 8 + 32 + (32 * 10); //TODO set storage for 10 clamaied accounts 
}