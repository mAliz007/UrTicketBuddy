export interface CreateVenueDto {
  name: string;
  location: string;
  layout: unknown;
  organizerId?: string | null;
}

export interface VenueActor {
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  organizerTenantId?: string | null;
}
