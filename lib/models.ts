import mongoose, { InferSchemaType } from "mongoose";

const { Schema } = mongoose;

export type SessionDoc = InferSchemaType<typeof SessionSchema>;
export type MemberDoc = InferSchemaType<typeof MemberSchema>;
export type PollDoc = InferSchemaType<typeof PollSchema>;
export type VoteDoc = InferSchemaType<typeof VoteSchema>;

const SessionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    adminKey: { type: String, required: true, index: true },
    plannedAttendeeCount: { type: Number, required: true, default: 0, min: 0 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

const MemberSchema = new Schema(
  {
    sessionCode: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    token: { type: String, required: true, unique: true, index: true },
    joinedAt: { type: Date, required: true, default: () => new Date() },
    kickedAt: { type: Date, required: false, default: null },
  },
  { timestamps: false }
);

const PollSchema = new Schema(
  {
    sessionCode: { type: String, required: true, index: true },
    problem: { type: String, required: true },
    startedAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    /** Voting window length in seconds (used for display; endsAt is authoritative) */
    durationSeconds: { type: Number, required: true, default: 10, min: 1 },
    closedAt: { type: Date, required: false, default: null },
    status: { type: String, required: true, enum: ["open", "closed"], default: "open", index: true },
  },
  { timestamps: false }
);

const VoteSchema = new Schema(
  {
    pollId: { type: Schema.Types.ObjectId, required: true, index: true, ref: "Poll" },
    sessionCode: { type: String, required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, required: true, index: true, ref: "Member" },
    fullNameSnapshot: { type: String, required: true },
    choice: { type: String, required: true, enum: ["approve", "deny"], index: true },
    votedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

VoteSchema.index({ pollId: 1, memberId: 1 }, { unique: true });

export const SessionModel =
  (mongoose.models.Session as mongoose.Model<SessionDoc>) || mongoose.model("Session", SessionSchema);
export const MemberModel =
  (mongoose.models.Member as mongoose.Model<MemberDoc>) || mongoose.model("Member", MemberSchema);
export const PollModel =
  (mongoose.models.Poll as mongoose.Model<PollDoc>) || mongoose.model("Poll", PollSchema);
export const VoteModel =
  (mongoose.models.Vote as mongoose.Model<VoteDoc>) || mongoose.model("Vote", VoteSchema);

