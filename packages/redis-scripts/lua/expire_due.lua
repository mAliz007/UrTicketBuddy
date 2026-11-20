-- Atomic Expire Due Holds Script
-- KEYS[1] = hold_expiry:{eventId}
-- ARGV[1] = eventId
-- ARGV[2] = nowMs (optional; <= 0 or omitted uses authoritative Redis TIME)

local holdExpiryKey = KEYS[1]
local eventId = ARGV[1]
local nowMs = tonumber(ARGV[2])
if not nowMs or nowMs <= 0 then
  local t = redis.call('TIME')
  nowMs = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
end

local holdOwnersKey = 'hold_owners:{' .. eventId .. '}'
local entries = redis.call('ZRANGE', holdExpiryKey, 0, -1, 'WITHSCORES')
local freedSeats = {}

for i = 1, #entries, 2 do
  local seatId = entries[i]
  local score = tonumber(entries[i + 1])
  local lockKey = 'seat_lock:{' .. eventId .. '}:' .. seatId
  local owner = redis.call('GET', lockKey)

  if (not owner) or (score <= nowMs) then
    if owner then
      redis.call('DEL', lockKey)
      redis.call('SREM', 'user_holds:{' .. eventId .. '}:' .. owner, seatId)
    else
      local mappedOwner = redis.call('HGET', holdOwnersKey, seatId)
      if mappedOwner then
        redis.call('SREM', 'user_holds:{' .. eventId .. '}:' .. mappedOwner, seatId)
      else
        local uhKeys = redis.call('KEYS', 'user_holds:{' .. eventId .. '}:*')
        for _, uhKey in ipairs(uhKeys) do
          redis.call('SREM', uhKey, seatId)
        end
      end
    end
    redis.call('HDEL', holdOwnersKey, seatId)
    redis.call('ZREM', holdExpiryKey, seatId)
    table.insert(freedSeats, seatId)
  end
end

return freedSeats
