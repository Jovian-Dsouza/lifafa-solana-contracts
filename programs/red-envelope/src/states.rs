use anchor_lang::prelude::*;
use crate::{ MAX_OWNER_NAME, MAX_DESC};


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
    pub desc: String
}

#[account]
#[derive(InitSpace)]
pub struct UserClaim {
    pub claimed: bool,
    pub amount_claimed: u64
}