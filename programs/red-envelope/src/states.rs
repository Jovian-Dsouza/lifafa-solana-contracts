use anchor_lang::prelude::*;
use crate::{ MAX_OWNER_NAME, MAX_DESC};
pub use crate::errors::LifafaError;

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ClaimMode {
    Random,
    Equal,
}

impl ClaimMode {
    pub fn from_u8(value: u8) -> Result<Self> {
        match value {
            0 => Ok(ClaimMode::Random),
            1 => Ok(ClaimMode::Equal),
            _ => Err(LifafaError::InvalidClaimMode.into()),
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct Lifafa {
    pub id: u64,
    pub creation_time: i64,
    pub time_limit: i64,
    pub owner: Pubkey,
    #[max_len(MAX_OWNER_NAME)]
    pub owner_name: String,
    pub claims: u64,
    pub max_claims: u64,
    pub mint_of_token_being_sent: Pubkey,
    pub amount: u64,
    #[max_len(MAX_DESC)]
    pub desc: String,
    pub bump: u8,
    pub claim_mode: ClaimMode,
}

#[account]
#[derive(InitSpace)]
pub struct UserClaim {
    pub claimed: bool,
    pub amount_claimed: u64
}