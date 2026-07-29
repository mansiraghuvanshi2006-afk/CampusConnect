import mongoose from "mongoose";

const academicYearSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },

    yearNumber: {
      type: Number,
      required: [true, "Year number is required"],
      min: 1,
    },

    name: {
      type: String,
      required: [true, "Year name is required"],
      trim: true,
    },

    sortOrder: {
      type: Number,
      required: true,
      default: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
  },
  {
    timestamps: true,
  }
);

academicYearSchema.index(
  {
    department: 1,
    yearNumber: 1,
  },
  {
    unique: true,
  }
);

const AcademicYear = mongoose.model(
  "AcademicYear",
  academicYearSchema
);

export default AcademicYear;