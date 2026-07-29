import mongoose from "mongoose";

const departmentSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: [
          true,
          "Department name is required",
        ],
        trim: true,
        minlength: [
          2,
          "Department name must contain at least 2 characters",
        ],
        maxlength: [
          100,
          "Department name cannot exceed 100 characters",
        ],
      },

      code: {
        type: String,
        required: [
          true,
          "Department code is required",
        ],
        trim: true,
        uppercase: true,
        minlength: [
          2,
          "Department code must contain at least 2 characters",
        ],
        maxlength: [
          20,
          "Department code cannot exceed 20 characters",
        ],
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

      durationInYears: {
        type: Number,
        required: [
          true,
          "Department duration is required",
        ],
        min: [
          1,
          "Department duration must be at least 1 year",
        ],
        max: [
          10,
          "Department duration cannot exceed 10 years",
        ],
        validate: {
          validator: Number.isInteger,
          message:
            "Department duration must be a whole number",
        },
      },

      isActive: {
        type: Boolean,
        default: true,
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [
          true,
          "Department creator is required",
        ],
      },
    },
    {
      timestamps: true,
      toJSON: {
        virtuals: true,
      },
      toObject: {
        virtuals: true,
      },
    }
  );

// Department names and codes must be unique.
departmentSchema.index(
  {
    name: 1,
  },
  {
    unique: true,
  }
);

departmentSchema.index(
  {
    code: 1,
  },
  {
    unique: true,
  }
);

// Makes department search faster.
departmentSchema.index({
  name: "text",
  code: "text",
  description: "text",
});

const Department =
  mongoose.model(
    "Department",
    departmentSchema
  );

export default Department;