import mongoose from "mongoose";

const Floor = mongoose.model(
  "Floor",
  new mongoose.Schema(
    {
      description: String,
      sign: String,
      index: Number,
      washrooms: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Washroom",
        },
      ],
      rooms: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Room",
        },
      ],
    },
    { timestamps: true }
  )
);

export default Floor;
