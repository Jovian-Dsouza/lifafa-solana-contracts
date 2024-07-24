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

    #[msg("Owner name too long")]
    OwnerNameTooLong,

    #[msg("Description too long")]
    DescriptionTooLong,

    #[msg("Lifafa Already Exists")]
    LifafaAlreadyExists,

    #[msg("Invalid Claim Mode")]
    InvalidClaimMode,
}