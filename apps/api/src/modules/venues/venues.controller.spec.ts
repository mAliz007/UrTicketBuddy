import { Test, TestingModule } from "@nestjs/testing";
import { AuthUser, UserRole } from "@urticketbuddy/contracts";
import { VenuesController } from "./venues.controller";
import { VenuesService } from "./venues.service";

describe("VenuesController", () => {
  let controller: VenuesController;

  const mockUser: AuthUser = {
    id: "org-1",
    email: "org@example.com",
    firstName: "Org",
    lastName: "Owner",
    role: UserRole.ORGANIZER,
    organizerTenantId: "org-1",
    createdAt: new Date(),
  };

  const mockVenuesService = {
    createVenue: jest.fn(),
    getVenueById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [
        {
          provide: VenuesService,
          useValue: mockVenuesService,
        },
      ],
    }).compile();

    controller = module.get<VenuesController>(VenuesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should delegate createVenue to VenuesService", async () => {
    const dto = {
      name: "Arena",
      location: "Metropolis",
      layout: { schemaVersion: 1, name: "Layout" },
    };
    mockVenuesService.createVenue.mockResolvedValue({
      id: "v-1",
      ...dto,
      layoutMongoId: "m-1",
    });

    const result = await controller.createVenue(dto, mockUser);
    expect(mockVenuesService.createVenue).toHaveBeenCalledWith(dto, mockUser);
    expect(result.id).toBe("v-1");
  });

  it("should delegate getVenueById to VenuesService", async () => {
    mockVenuesService.getVenueById.mockResolvedValue({
      id: "v-1",
      name: "Arena",
      layout: {},
    });

    const result = await controller.getVenueById("v-1");
    expect(mockVenuesService.getVenueById).toHaveBeenCalledWith("v-1");
    expect(result.id).toBe("v-1");
  });
});
