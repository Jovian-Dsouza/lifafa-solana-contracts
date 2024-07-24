pub fn xor_shift(mut seed: u64) -> u64 {
    seed ^= seed << 12;
    seed ^= seed >> 25;
    seed ^= seed << 27;
    seed = (seed as u128 * 0x2545F4914F6CDD1D) as u64;
    return seed;
}