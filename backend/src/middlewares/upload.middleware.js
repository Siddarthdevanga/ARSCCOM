import multer from "multer";

/**
 * Multer configuration
 * - Uses memory storage (required for S3 upload)
 * - Limits file size to 2MB
 * - Allows only image MIME types
 */

const storage = multer.memoryStorage();

export const upload = multer({
  storage,

  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(
        new Error("Only image files are allowed"),
        false
      );
    }

    cb(null, true);
  }
});
