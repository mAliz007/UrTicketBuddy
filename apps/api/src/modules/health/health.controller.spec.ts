import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
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
              service: "api",
              timestamp: new Date().toISOString(),
              dependencies: {
                postgres: "down",
                mongo: "down",
                redis: "down",
                elasticsearch: "down",
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

  it("should return health status", async () => {
    const res = await controller.getHealth();
    expect(res.status).toBe("ok");
    expect(res.service).toBe("api");
  });
});
