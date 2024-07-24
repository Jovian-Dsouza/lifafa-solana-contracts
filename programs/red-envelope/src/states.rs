use anchor_lang::prelude::*;
use crate::{ MAX_OWNER_NAME, MAX_DESC};

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ClaimMode {
    Random,
    Equal,
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