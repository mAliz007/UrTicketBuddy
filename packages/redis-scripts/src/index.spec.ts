import { SEAT_HOLD_LUA, RedisScriptsWrapper } from "./index";

describe("packages/redis-scripts", () => {
  it("should have valid Lua script string", () => {
    expect(SEAT_HOLD_LUA).toContain("SEAT_ALREADY_SOLD");
    expect(SEAT_HOLD_LUA).toContain("SEAT_ALREADY_HELD");
  });

  it("should instantiate wrapper and define command", () => {
    const mockRedis: any = {
      defineCommand: jest.fn(),
    };
    const wrapper = new RedisScriptsWrapper(mockRedis);
    expect(wrapper).toBeDefined();
    expect(mockRedis.defineCommand).toHaveBeenCalledWith(
      "atomicSeatHold",
      expect.any(Object),
    );
  });
});
