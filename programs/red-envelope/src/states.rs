use anchor_lang::prelude::*;
use crate::{MAX_CLAIMS_ALLOWED, MAX_OWNER_NAME, MAX_DESC};


#[account]
pub struct Lifafa {
    pub id: u64,
    pub creation_time: i64,
    pub time_limit: i64,
    pub owner: Pubkey,
    pub owner_name: String,
    pub claimed: Vec<[u8; 8]>, // Stores the first 8 bytes of the hash of the claimant's public key
    pub max_claims: u16,
    pub mint_of_token_being_sent: Pubkey,
    pub amount: u64,
    pub desc: String
}

impl Lifafa {
    pub const MAX_SIZE: usize = 8 + 8 + 8 + 32 + MAX_OWNER_NAME as usize + 4+(MAX_CLAIMS_ALLOWED as usize * 8) + 4 + 32 + 8 + MAX_DESC as usize ;
}