import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { SearchService } from "../search/search.service";

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
              search: {
                alias: "events",
                eventsAliasExists: false,
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
    expect(res.search).toEqual({ alias: "events", eventsAliasExists: false });
  });

  it("HealthService reports eventsAliasExists from SearchService when Elasticsearch TCP is reachable", async () => {
    const mockSearchService = {
      checkAliasExists: jest.fn().mockResolvedValue(true),
    } as unknown as SearchService;

    const healthService = new HealthService(mockSearchService);
    jest
      .spyOn(
        healthService as unknown as {
          checkTcpPort: (host: string, port: number) => Promise<boolean>;
        },
        "checkTcpPort",
      )
      .mockResolvedValue(true);

    const res = await healthService.checkHealth();
    expect(res.dependencies.elasticsearch).toBe("up");
    expect(res.search).toEqual({ alias: "events", eventsAliasExists: true });
  });
});
