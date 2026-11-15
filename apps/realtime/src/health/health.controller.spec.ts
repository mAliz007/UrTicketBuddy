import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("Realtime HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            checkHealth: jest.fn().mockResolvedValue({
              status: "ok",
              service: "realtime",
              timestamp: new Date().toISOString(),
              dependencies: {
                redis: "down",
              },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should return realtime health status", async () => {
    const res = await controller.getHealth();
    expect(res.status).toBe("ok");
    expect(res.service).toBe("realtime");
  });
});
