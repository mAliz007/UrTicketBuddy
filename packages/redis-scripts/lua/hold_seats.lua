-- Atomic Multi-Seat Hold Script
-- KEYS[1] = seat_sold:{eventId}
-- KEYS[2] = hold_expiry:{eventId}
-- KEYS[3] = user_holds:{eventId}:{userId}
-- KEYS[4..3+N] = seat_lock:{eventId}:{seatId} (optional explicit keys; falls back to hash-tagged construction)
-- ARGV[1] = eventId
-- ARGV[2] = userId
-- ARGV[3] = ttlSeconds (default 600)
-- ARGV[4] = maxPerUser
-- ARGV[5] = nowMs (UTC epoch milliseconds)
-- ARGV[6..5+N] = seatIds[]

local soldKey = KEYS[1]
local holdExpiryKey = KEYS[2]
local userHoldsKey = KEYS[3]

local eventId = ARGV[1]
local userId = ARGV[2]
local ttlSeconds = tonumber(ARGV[3]) or 600
local maxPerUser = tonumber(ARGV[4]) or 6
local nowMs = tonumber(ARGV[5])

local seatIds = {}
local lockKeys = {}
local seen = {}

for i = 6, #ARGV do
  local seatId = ARGV[i]
  if not seen[seatId] then
    seen[seatId] = true
    table.insert(seatIds, seatId)
    local keyIndex = 3 + #seatIds
    local lockKey = KEYS[keyIndex] or ('seat_lock:{' .. eventId .. '}:' .. seatId)
    lockKeys[seatId] = lockKey
  end
end

if #seatIds == 0 then
  return { 0, 'VALIDATION_ERROR', {} }
end

-- Step 1: Atomic conflict check (sold or live lock owned by someone else)
local conflicts = {}
for _, seatId in ipairs(seatIds) do
  local isSold = redis.call('SISMEMBER', soldKey, seatId) == 1
  if isSold then
    table.insert(conflicts, seatId)
  else
    local lockKey = lockKeys[seatId]
    local owner = redis.call('GET', lockKey)
    local score = redis.call('ZSCORE', holdExpiryKey, seatId)
    local isExpired = score and (tonumber(score) <= nowMs)
    if owner and (not isExpired) and owner ~= userId then
      table.insert(conflicts, seatId)
    end
  end
end

if #conflicts > 0 then
  return { 0, 'SEAT_ALREADY_HELD', conflicts }
end

-- Step 2: Enforce maxPerUser across active existing holds + newly requested seats
local existingHeldSeats = redis.call('SMEMBERS', userHoldsKey)
local activeExistingSet = {}
local staleExistingSeats = {}
local activeExistingCount = 0

for _, heldSeatId in ipairs(existingHeldSeats) do
  local heldLockKey = 'seat_lock:{' .. eventId .. '}:' .. heldSeatId
  local heldOwner = redis.call('GET', heldLockKey)
  local heldScore = redis.call('ZSCORE', holdExpiryKey, heldSeatId)
  local heldExpired = heldScore and (tonumber(heldScore) <= nowMs)
  if heldOwner == userId and (not heldExpired) then
    activeExistingSet[heldSeatId] = true
    activeExistingCount = activeExistingCount + 1
  else
    table.insert(staleExistingSeats, heldSeatId)
  end
end

local newSeatsCount = 0
for _, seatId in ipairs(seatIds) do
  if not activeExistingSet[seatId] then
    newSeatsCount = newSeatsCount + 1
  end
end

if (activeExistingCount + newSeatsCount) > maxPerUser then
  return { 0, 'TOO_MANY_SEATS', {} }
end

-- Step 3: Clean up any stale entries in user_holds and apply all locks atomically
for _, staleSeatId in ipairs(staleExistingSeats) do
  redis.call('SREM', userHoldsKey, staleSeatId)
  local staleLockKey = 'seat_lock:{' .. eventId .. '}:' .. staleSeatId
  if not redis.call('GET', staleLockKey) then
    redis.call('ZREM', holdExpiryKey, staleSeatId)
  end
end

local expiresAtMs = nowMs + (ttlSeconds * 1000)

for _, seatId in ipairs(seatIds) do
  local lockKey = lockKeys[seatId]
  redis.call('SET', lockKey, userId, 'EX', ttlSeconds)
  redis.call('ZADD', holdExpiryKey, expiresAtMs, seatId)
  redis.call('SADD', userHoldsKey, seatId)
end

return { 1, 'OK', tostring(expiresAtMs), seatIds }
