import { AppDataSource } from "./index";

describe("packages/db", () => {
  it("should define AppDataSource with correct options", () => {
    expect(AppDataSource).toBeDefined();
    expect(AppDataSource.options.type).toBe("postgres");
    expect(AppDataSource.options.synchronize).toBe(false);
  });
});
