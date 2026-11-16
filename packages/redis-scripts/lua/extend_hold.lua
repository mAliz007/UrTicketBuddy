-- Atomic Extend Hold Script (Once per user per event, +120s grace period)
-- KEYS[1] = hold_expiry:{eventId}
-- KEYS[2] = user_holds:{eventId}:{userId}
-- KEYS[3] = hold_extended:{eventId}:{userId}
-- KEYS[4..3+N] = seat_lock:{eventId}:{seatId} (optional explicit keys)
-- ARGV[1] = eventId
-- ARGV[2] = userId
-- ARGV[3] = graceSeconds (default 120)
-- ARGV[4] = nowMs
-- ARGV[5..4+N] = seatIds[] (optional; defaults to all members of user_holds)

local holdExpiryKey = KEYS[1]
local userHoldsKey = KEYS[2]
local holdExtendedKey = KEYS[3]

local eventId = ARGV[1]
local userId = ARGV[2]
local graceSeconds = tonumber(ARGV[3]) or 120
local nowMs = tonumber(ARGV[4])

local seatIds = {}
local lockKeys = {}
local seen = {}

if #ARGV >= 5 then
  for i = 5, #ARGV do
    local seatId = ARGV[i]
    if not seen[seatId] then
      seen[seatId] = true
      table.insert(seatIds, seatId)
      local keyIndex = 3 + #seatIds
      lockKeys[seatId] = KEYS[keyIndex] or ('seat_lock:{' .. eventId .. '}:' .. seatId)
    end
  end
else
  local heldMembers = redis.call('SMEMBERS', userHoldsKey)
  table.sort(heldMembers)
  for _, seatId in ipairs(heldMembers) do
    table.insert(seatIds, seatId)
    lockKeys[seatId] = 'seat_lock:{' .. eventId .. '}:' .. seatId
  end
end

if #seatIds == 0 then
  return { 0, 'HOLD_EXPIRED', {} }
end

local notOwnedSeats = {}
local expiredSeats = {}

for _, seatId in ipairs(seatIds) do
  local lockKey = lockKeys[seatId]
  local owner = redis.call('GET', lockKey)
  local score = redis.call('ZSCORE', holdExpiryKey, seatId)
  local isExpiredScore = score and nowMs and (tonumber(score) <= nowMs)

  if (not owner) or isExpiredScore then
    table.insert(expiredSeats, seatId)
  elseif owner ~= userId then
    table.insert(notOwnedSeats, seatId)
  end
end

if #notOwnedSeats > 0 then
  return { 0, 'SEAT_NOT_HELD_BY_YOU', notOwnedSeats }
end

if #expiredSeats > 0 then
  return { 0, 'HOLD_EXPIRED', expiredSeats }
end

if redis.call('EXISTS', holdExtendedKey) == 1 then
  return { 0, 'HOLD_ALREADY_EXTENDED', {} }
end

local graceMs = graceSeconds * 1000
local maxExpiresAtMs = 0

for _, seatId in ipairs(seatIds) do
  local lockKey = lockKeys[seatId]
  local pttl = redis.call('PTTL', lockKey)
  if pttl < 0 then
    pttl = 0
  end
  local newPttl = pttl + graceMs
  redis.call('PEXPIRE', lockKey, newPttl)

  local currentScore = tonumber(redis.call('ZSCORE', holdExpiryKey, seatId))
  if not currentScore then
    currentScore = nowMs + pttl
  end
  local newExpiresAtMs = currentScore + graceMs
  redis.call('ZADD', holdExpiryKey, newExpiresAtMs, seatId)

  if newExpiresAtMs > maxExpiresAtMs then
    maxExpiresAtMs = newExpiresAtMs
  end
end

redis.call('SET', holdExtendedKey, '1')

return { 1, 'OK', tostring(maxExpiresAtMs), seatIds }
