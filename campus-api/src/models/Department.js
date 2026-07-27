import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
      minlength: [2, "Department name must contain at least 2 characters"],
      maxlength: [100, "Department name cannot exceed 100 characters"],
    },

    code: {
      type: String,
      required: [true, "Department code is required"],
      trim: true,
      uppercase: true,
      minlength: [2, "Department code must contain at least 2 characters"],
      maxlength: [20, "Department code cannot exceed 20 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Department description cannot exceed 500 characters",
      ],
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Department creator is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Department names and codes should be unique.
departmentSchema.index({ name: 1 }, { unique: true });
departmentSchema.index({ code: 1 }, { unique: true });

const Department = mongoose.model("Department", departmentSchema);

export default Department;