/**
 * Named sequences for human-friendly numbers (pet registration no., report reference).
 * $inc with upsert is atomic, so two requests can never receive the same number.
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });

counterSchema.statics.next = async function next(key) {
  const doc = await this.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
