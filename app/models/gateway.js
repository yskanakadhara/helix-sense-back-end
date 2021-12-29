import mongoose from "mongoose";

const Gateway = mongoose.model(
  "Gateway",
  new mongoose.Schema(
    {
      gateway_id: String,
      region: String,
      city: String,
      state: String,
      company: String,
      company_unit: String,
      washroom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Washroom",
      },
      room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
      },
    },
    { timestamps: true }
  )
);

export default Gateway;
