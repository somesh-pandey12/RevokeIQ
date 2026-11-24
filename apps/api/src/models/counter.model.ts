import { Schema, model } from "mongoose";
import { tenantGuard } from "./plugins/tenantGuard";

const counterSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });
counterSchema.plugin(tenantGuard);

export const Counter = model("Counter", counterSchema);

export async function nextSequence(tenantId: string, key: string) {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  return counter.seq;
}