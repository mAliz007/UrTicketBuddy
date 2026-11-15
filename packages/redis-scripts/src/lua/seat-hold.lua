-- Atomic Seat Hold Script
-- KEYS[1] = seat_lock key (e.g. "seat_lock:{eventId}:seatId")
-- KEYS[2] = seat_sold key (e.g. "seat_sold:{eventId}")
-- KEYS[3] = hold_expiry key (e.g. "hold_expiry:{eventId}")
-- KEYS[4] = user_holds key (e.g. "user_holds:{eventId}:userId")
-- ARGV[1] = userId
-- ARGV[2] = seatId
-- ARGV[3] = ttlSeconds (e.g. 600)
-- ARGV[4] = expiryTimestampMs

-- Check if already sold
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
    return {0, 'SEAT_ALREADY_SOLD'}
end

-- Try acquiring lock NX EX
local acquired = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', tonumber(ARGV[3]))
if not acquired then
    return {0, 'SEAT_ALREADY_HELD'}
end

-- Track expiry and user hold
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[2])
redis.call('SADD', KEYS[4], ARGV[2])

return {1, 'OK'}
