import { TicketTierInput } from "@urticketbuddy/contracts";

export interface CreateEventDto {
  venueId: string;
  name: string;
  startTime: string;
  status?: string;
  organizerId?: string | null;
  ticketTiers?: TicketTierInput[];
}

export interface EventActor {
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  organizerTenantId?: string | null;
}
