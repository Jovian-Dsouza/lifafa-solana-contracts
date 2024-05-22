use anchor_lang::error_code;

#[error_code]
pub enum LifafaError {
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