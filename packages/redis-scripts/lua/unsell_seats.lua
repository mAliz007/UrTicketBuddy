-- Atomic Unsell Seats Script (Admin Revocation)
-- KEYS[1] = seat_sold:{eventId}
-- ARGV[1] = eventId
-- ARGV[2..1+N] = seatIds[]

local soldKey = KEYS[1]
local removed = {}
local seen = {}

for i = 2, #ARGV do
  local seatId = ARGV[i]
  if not seen[seatId] then
    seen[seatId] = true
    if redis.call('SREM', soldKey, seatId) == 1 then
      table.insert(removed, seatId)
    end
  end
end

return { 1, 'OK', removed }
