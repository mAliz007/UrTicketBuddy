import { Schema, model, Document, Model } from "mongoose";

export interface VenueLayoutDocument extends Document {
  name: string;
  schemaVersion: number;
  version: number;
  previousLayoutId?: string | null;
  dimensions?: {
    width: number;
    height: number;
  };
  sections: unknown[];
  seats: unknown[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const VenueLayoutSchema = new Schema<VenueLayoutDocument>(
  {
    name: { type: String, required: true },
    schemaVersion: { type: Number, required: true, default: 1 },
    version: { type: Number, required: true, default: 1 },
    previousLayoutId: { type: String, required: false, default: null },
    dimensions: {
      type: {
        width: { type: Number },
        height: { type: Number },
      },
      required: false,
      _id: false,
    },
    sections: [Schema.Types.Mixed],
    seats: [Schema.Types.Mixed],
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "venue_layouts",
  },
);

export const VenueLayoutModel: Model<VenueLayoutDocument> =
  model<VenueLayoutDocument>("VenueLayout", VenueLayoutSchema);
