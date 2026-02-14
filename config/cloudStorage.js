const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudStorage {
  // Upload file buffer to Cloudinary
  static async uploadBuffer(
    buffer,
    key,
    contentType = "application/octet-stream",
  ) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: key,
          resource_type: "auto",
          timeout: 120000, // 2 minute timeout for faster failure detection
          // access_mode: 'public' // Default is public
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );

      // Write buffer to stream
      uploadStream.end(buffer);
    });
  }

  // Upload file from local path to Cloudinary
  static async uploadFile(filePath, key, contentType) {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: key,
      resource_type: "auto",
    });
    return result.secure_url;
  }

  // Get URL (Signed if necessary)
  static getSignedUrl(key, expires = 3600) {
    if (!key) return key;

    // If it's a full URL, we need to re-sign it to ensure access to restricted assets
    if (key.startsWith("http")) {
      try {
        const parts = key.split("/upload/");
        if (parts.length === 2) {
          const prefixParts = parts[0].split("/");
          const resourceType = prefixParts[prefixParts.length - 1];
          let publicId = parts[1].replace(/^v\d+\//, "");
          publicId = decodeURIComponent(publicId);

          return cloudinary.url(publicId, {
            resource_type: resourceType,
            sign_url: true,
            secure: true,
          });
        }
      } catch (e) {
        console.error("Error signing URL:", e);
        return key;
      }
      return key;
    }

    // Otherwise construct Cloudinary URL from key
    return cloudinary.url(key, {
      secure: true,
      resource_type: "auto",
      sign_url: true, // Always sign to be safe
    });
  }

  // Get Download URL (forces attachment)
  static getDownloadUrl(url) {
    if (!url || !url.startsWith("http")) return url;

    try {
      // Split by /upload/ to isolate parts
      const parts = url.split("/upload/");
      if (parts.length === 2) {
        // Extract resource_type (last segment of the prefix)
        // e.g. .../image/upload/... -> image
        const prefixParts = parts[0].split("/");
        const resourceType = prefixParts[prefixParts.length - 1];

        // Extract public_id
        // Remove version prefix (e.g. v123456/) if present
        let publicId = parts[1].replace(/^v\d+\//, "");

        // Decode URI components (in case the extracted ID is encoded)
        publicId = decodeURIComponent(publicId);

        // Generate signed URL with attachment flag
        return cloudinary.url(publicId, {
          resource_type: resourceType,
          flags: "attachment",
          sign_url: true, // Required if Strict Transformations are enabled
          secure: true,
        });
      }
    } catch (e) {
      console.error("Error generating signed download URL:", e);
    }

    return url;
  }

  // Delete file from Cloudinary
  static async deleteFile(key) {
    let publicId = key;

    // If key is a URL, extract public_id
    if (key.startsWith("http")) {
      try {
        // Example: https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg
        // We want 'sample.jpg' (since we included extension in our public_id generation)
        // OR if version is present: v1234/folder/file.ext

        // Split by 'upload/'
        const parts = key.split("/upload/");
        if (parts.length === 2) {
          let suffix = parts[1];
          // Remove version if present (v12345/)
          if (suffix.startsWith("v")) {
            const vIndex = suffix.indexOf("/");
            if (vIndex !== -1) {
              suffix = suffix.substring(vIndex + 1);
            }
          }
          publicId = suffix;
          // Note: If Cloudinary added ANY extension that wasn't in public_id, we might need to strip it.
          // But our generateKey INCLUDES extension, so public_id has it.
          // So we should be good.

          // Decode URI components just in case
          publicId = decodeURIComponent(publicId);
        }
      } catch (e) {
        console.error("Error parsing Cloudinary URL for deletion:", e);
      }
    }

    console.log(`Deleting from Cloudinary: ${publicId}`); // Debug log
    await cloudinary.uploader.destroy(publicId);
  }

  // Generate unique key for file - Maps to Cloudinary public_id
  static generateKey(prefix, originalName) {
    const timestamp = Date.now();
    const extension = path.extname(originalName);
    const basename = path.basename(originalName, extension);
    // Cloudinary public_ids work best without extensions for images, but for raw files (docx) extension is good.
    // We'll keep the extension in the ID for clarity/download.
    return `${prefix}/${timestamp}_${basename}${extension}`.replace(/\\/g, "/");
  }
}

module.exports = CloudStorage;
