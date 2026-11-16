-- Atomic Seat Release Script
-- KEYS[1] = hold_expiry:{eventId}
-- KEYS[2] = user_holds:{eventId}:{userId}
-- KEYS[3..2+N] = seat_lock:{eventId}:{seatId} (optional explicit keys)
-- ARGV[1] = eventId
-- ARGV[2] = userId
-- ARGV[3..2+N] = seatIds[]

local holdExpiryKey = KEYS[1]
local userHoldsKey = KEYS[2]

local eventId = ARGV[1]
local userId = ARGV[2]

local seatIds = {}
local lockKeys = {}
local seen = {}

for i = 3, #ARGV do
  local seatId = ARGV[i]
  if not seen[seatId] then
    seen[seatId] = true
    table.insert(seatIds, seatId)
    local keyIndex = 2 + #seatIds
    lockKeys[seatId] = KEYS[keyIndex] or ('seat_lock:{' .. eventId .. '}:' .. seatId)
  end
end

local notOwned = {}
for _, seatId in ipairs(seatIds) do
  local owner = redis.call('GET', lockKeys[seatId])
  if owner ~= userId then
    table.insert(notOwned, seatId)
  end
end

if #notOwned > 0 then
  return { 0, 'SEAT_NOT_HELD_BY_YOU', notOwned }
end

for _, seatId in ipairs(seatIds) do
  redis.call('DEL', lockKeys[seatId])
  redis.call('ZREM', holdExpiryKey, seatId)
  redis.call('SREM', userHoldsKey, seatId)
end

return { 1, 'OK', seatIds }
