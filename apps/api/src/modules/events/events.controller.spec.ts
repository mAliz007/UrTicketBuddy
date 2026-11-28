import { Test, TestingModule } from "@nestjs/testing";
import { AuthUser, UserRole } from "@urticketbuddy/contracts";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

describe("EventsController", () => {
  let controller: EventsController;

  const mockUser: AuthUser = {
    id: "org-1",
    email: "org@example.com",
    firstName: "Org",
    lastName: "Owner",
    role: UserRole.ORGANIZER,
    organizerTenantId: "org-1",
    createdAt: new Date(),
  };

  const mockEventsService = {
    createEvent: jest.fn(),
    getEventById: jest.fn(),
    generateSeats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should delegate createEvent to service", async () => {
    const dto = {
      venueId: "v-1",
      name: "Concert",
      startTime: new Date().toISOString(),
    };
    mockEventsService.createEvent.mockResolvedValue({ id: "e-1", ...dto });

    const result = await controller.createEvent(dto, mockUser);
    expect(mockEventsService.createEvent).toHaveBeenCalledWith(dto, mockUser);
    expect(result.id).toBe("e-1");
  });

  it("should delegate getEventById to service", async () => {
    mockEventsService.getEventById.mockResolvedValue({
      id: "e-1",
      name: "Concert",
    });

    const result = await controller.getEventById("e-1");
    expect(mockEventsService.getEventById).toHaveBeenCalledWith("e-1");
    expect(result.id).toBe("e-1");
  });

  it("should delegate generateSeats to service", async () => {
    mockEventsService.generateSeats.mockResolvedValue({
      eventId: "e-1",
      totalSeatsGenerated: 200,
      status: "COMPLETED",
    });

    const result = await controller.generateSeats("e-1", mockUser);
    expect(mockEventsService.generateSeats).toHaveBeenCalledWith(
      "e-1",
      mockUser,
    );
    expect(result.totalSeatsGenerated).toBe(200);
  });
});
