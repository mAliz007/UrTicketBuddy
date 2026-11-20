-- Atomic Confirm Sold Script
-- KEYS[1] = seat_sold:{eventId}
-- KEYS[2] = hold_expiry:{eventId}
-- KEYS[3] = user_holds:{eventId}:{userId}
-- KEYS[4..3+N] = seat_lock:{eventId}:{seatId} (optional explicit keys)
-- ARGV[1] = eventId
-- ARGV[2] = userId
-- ARGV[3] = nowMs
-- ARGV[4..3+N] = seatIds[]

local soldKey = KEYS[1]
local holdExpiryKey = KEYS[2]
local userHoldsKey = KEYS[3]

local eventId = ARGV[1]
local userId = ARGV[2]
local nowMs = tonumber(ARGV[3])

local seatIds = {}
local lockKeys = {}
local seen = {}

for i = 4, #ARGV do
  local seatId = ARGV[i]
  if not seen[seatId] then
    seen[seatId] = true
    table.insert(seatIds, seatId)
    local keyIndex = 3 + #seatIds
    lockKeys[seatId] = KEYS[keyIndex] or ('seat_lock:{' .. eventId .. '}:' .. seatId)
  end
end

local notOwnedSeats = {}
local expiredSeats = {}

for _, seatId in ipairs(seatIds) do
  local owner = redis.call('GET', lockKeys[seatId])
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

local holdOwnersKey = 'hold_owners:{' .. eventId .. '}'

for _, seatId in ipairs(seatIds) do
  redis.call('SADD', soldKey, seatId)
  redis.call('DEL', lockKeys[seatId])
  redis.call('ZREM', holdExpiryKey, seatId)
  redis.call('SREM', userHoldsKey, seatId)
  redis.call('HDEL', holdOwnersKey, seatId)
end

return { 1, 'OK', seatIds }
