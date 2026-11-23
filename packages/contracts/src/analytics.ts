export interface EntryVelocityBucket {
  timestamp: string;
  count: number;
}

export interface HoldStats {
  held: number;
  sold: number;
}

export interface ResaleStats {
  activeListings: number;
  soldListings: number;
  totalResaleVolume: number;
}

export interface OrganizerAnalyticsResponse {
  eventId: string;
  totalRevenue: number;
  ticketsSold: number;
  totalCapacity: number;
  occupancyRate: number;
  entryVelocity: EntryVelocityBucket[];
  holdStats: HoldStats;
  resaleStats: ResaleStats;
}
