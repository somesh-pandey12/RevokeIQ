import { Schema, Query, MongooseQueryMiddleware } from "mongoose";

const GUARDED_OPS: MongooseQueryMiddleware[] = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
];

export function tenantGuard(schema: Schema) {
  schema.pre(GUARDED_OPS, function (this: Query<unknown, unknown>) {
    if (this.getOptions().skipTenantGuard) return;
    if (this.getFilter().tenantId === undefined) {
      throw new Error(
        `Tenant guard: ${this.model.modelName}.${this.op}() called without tenantId`
      );
    }
  });
}