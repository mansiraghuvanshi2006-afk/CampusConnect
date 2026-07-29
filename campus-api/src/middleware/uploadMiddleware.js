import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import multer from "multer";

import ApiError from "../utils/ApiError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_ROOT = path.resolve(
  __dirname,
  "../../uploads"
);

export const CHAT_UPLOAD_DIR = path.join(UPLOAD_ROOT, "chat");

const ensureDirs = () => {
  fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
};

ensureDirs();

export const ALLOWED_MIME_TYPES = Object.freeze({
  // Images
  "image/jpeg": { category: "image", ext: ".jpg", maxBytes: 10 * 1024 * 1024 },
  "image/png": { category: "image", ext: ".png", maxBytes: 10 * 1024 * 1024 },
  "image/gif": { category: "image", ext: ".gif", maxBytes: 10 * 1024 * 1024 },
  "image/webp": { category: "image", ext: ".webp", maxBytes: 10 * 1024 * 1024 },
  // Documents
  "application/pdf": { category: "file", ext: ".pdf", maxBytes: 25 * 1024 * 1024 },
  "application/msword": { category: "file", ext: ".doc", maxBytes: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    category: "file",
    ext: ".docx",
    maxBytes: 25 * 1024 * 1024,
  },
  "application/vnd.ms-excel": { category: "file", ext: ".xls", maxBytes: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    category: "file",
    ext: ".xlsx",
    maxBytes: 25 * 1024 * 1024,
  },
  "application/vnd.ms-powerpoint": { category: "file", ext: ".ppt", maxBytes: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    category: "file",
    ext: ".pptx",
    maxBytes: 25 * 1024 * 1024,
  },
  "application/zip": { category: "file", ext: ".zip", maxBytes: 50 * 1024 * 1024 },
  "application/x-zip-compressed": { category: "file", ext: ".zip", maxBytes: 50 * 1024 * 1024 },
  "text/plain": { category: "file", ext: ".txt", maxBytes: 5 * 1024 * 1024 },
  // Video
  "video/mp4": { category: "file", ext: ".mp4", maxBytes: 100 * 1024 * 1024 },
  "video/webm": { category: "file", ext: ".webm", maxBytes: 100 * 1024 * 1024 },
  // Audio / voice
  "audio/webm": { category: "voice", ext: ".webm", maxBytes: 10 * 1024 * 1024 },
  "audio/mpeg": { category: "voice", ext: ".mp3", maxBytes: 10 * 1024 * 1024 },
  "audio/mp4": { category: "voice", ext: ".m4a", maxBytes: 10 * 1024 * 1024 },
  "audio/ogg": { category: "voice", ext: ".ogg", maxBytes: 10 * 1024 * 1024 },
  "audio/wav": { category: "voice", ext: ".wav", maxBytes: 10 * 1024 * 1024 },
  "audio/x-wav": { category: "voice", ext: ".wav", maxBytes: 10 * 1024 * 1024 },
});

const ABSOLUTE_MAX_BYTES = 100 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirs();
    cb(null, CHAT_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const allowed = ALLOWED_MIME_TYPES[file.mimetype];
    const ext =
      allowed?.ext ||
      path.extname(file.originalname).toLowerCase() ||
      ".bin";
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(
      new ApiError(
        400,
        `Unsupported file type: ${file.mimetype}`
      )
    );
    return;
  }

  cb(null, true);
};

export const chatUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: ABSOLUTE_MAX_BYTES,
    files: 5,
  },
});

export const validateUploadedFiles = (files = []) => {
  for (const file of files) {
    const allowed = ALLOWED_MIME_TYPES[file.mimetype];

    if (!allowed) {
      throw new ApiError(
        400,
        `Unsupported file type: ${file.mimetype}`
      );
    }

    if (file.size > allowed.maxBytes) {
      throw new ApiError(
        400,
        `${file.originalname} exceeds the maximum size of ${Math.round(allowed.maxBytes / (1024 * 1024))}MB`
      );
    }
  }
};

export const buildPublicUploadUrl = (fileName) =>
  `/uploads/chat/${fileName}`;

export const toAbsoluteUploadPath = (fileName) =>
  path.join(CHAT_UPLOAD_DIR, fileName);
