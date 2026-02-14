const { google } = require("googleapis");
const path = require("path");
const stream = require("stream");
const fs = require("fs");

// OAuth2 credentials from Google Cloud Console
const CREDENTIALS_PATH = path.join(process.cwd(), "google-credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "google-token.json");

let drive = null;

// Initialize OAuth2 client
function getOAuth2Client() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("google-credentials.json not found!");
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));

  // Check if it's OAuth credentials (has installed or web key) or service account
  const creds = credentials.installed || credentials.web || credentials;

  if (!creds.client_id || !creds.client_secret) {
    console.error(
      "Invalid OAuth credentials. Need OAuth 2.0 Client ID, not Service Account.",
    );
    console.error(
      "Go to Google Cloud Console → Credentials → Create OAuth 2.0 Client ID",
    );
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uris
      ? creds.redirect_uris[0]
      : "http://localhost:3000/auth/google/callback",
  );

  // Load saved token if exists
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oauth2Client.setCredentials(token);
    console.log("✅ Google Drive OAuth loaded from saved token");
  }

  return oauth2Client;
}

// Get authorization URL for first-time setup
function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    prompt: "consent",
  });
}

// Exchange authorization code for tokens
async function setAuthCode(code) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return false;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save token for future use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log("✅ Google Drive token saved successfully");

    // Reset drive client
    drive = null;

    return true;
  } catch (error) {
    console.error("Error getting token:", error.message);
    return false;
  }
}

// Initialize Drive client
function initializeDrive() {
  if (drive) return drive;

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  // Check if we have valid credentials
  if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
    console.error(
      "❌ Google Drive not authorized. Visit /admin/google-auth to authorize.",
    );
    return null;
  }

  drive = google.drive({ version: "v3", auth: oauth2Client });
  console.log("✅ Google Drive initialized successfully");
  return drive;
}

// Check if authorized
function isAuthorized() {
  if (!fs.existsSync(TOKEN_PATH)) return false;
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  return !!token.access_token;
}

class GoogleDriveStorage {
  static getFolderId() {
    return process.env.GOOGLE_DRIVE_FOLDER_ID;
  }

  static isAuthorized() {
    return isAuthorized();
  }

  static getAuthUrl() {
    return getAuthUrl();
  }

  static async setAuthCode(code) {
    return setAuthCode(code);
  }

  // Find or create a folder within a parent folder
  static async findOrCreateFolder(driveClient, folderName, parentId) {
    try {
      // Check if folder exists
      const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
      const response = await driveClient.files.list({
        q: query,
        fields: "files(id, name)",
        spaces: "drive",
      });

      if (response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create folder if not exists
      const fileMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      };

      const folder = await driveClient.files.create({
        resource: fileMetadata,
        fields: "id",
      });

      return folder.data.id;
    } catch (error) {
      console.error(`Error finding/creating folder ${folderName}:`, error);
      throw error;
    }
  }

  // Upload file buffer to Google Drive with optional subfolder path
  // subfolderPath: array of folder names, e.g. ['Cases', 'INV-123', 'Documents']
  static async uploadBuffer(
    buffer,
    fileName,
    mimeType = "application/octet-stream",
    subfolderPath = [],
  ) {
    const driveClient = initializeDrive();
    if (!driveClient) {
      throw new Error(
        "Google Drive not authorized. Visit /admin/google-auth to authorize.",
      );
    }

    let folderId = this.getFolderId();
    if (!folderId || folderId === "YOUR_FOLDER_ID_HERE") {
      throw new Error("GOOGLE_DRIVE_FOLDER_ID not set in .env");
    }

    // Traverse/Create user defined subfolders
    if (subfolderPath && subfolderPath.length > 0) {
      for (const folderName of subfolderPath) {
        folderId = await this.findOrCreateFolder(
          driveClient,
          folderName,
          folderId,
        );
      }
    }

    // Create a readable stream from the buffer
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    try {
      const response = await driveClient.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: mimeType,
          body: bufferStream,
        },
        fields: "id, name, webViewLink, webContentLink",
      });

      // Make file accessible via link
      await driveClient.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Get the direct download link
      const fileId = response.data.id;
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

      console.log(
        `✅ Uploaded to Google Drive: ${subfolderPath.join("/")}/${fileName}`,
      );

      return {
        fileId: fileId,
        filePath: downloadUrl, // For compatibility with existing code
        url: downloadUrl,
        viewUrl: response.data.webViewLink,
      };
    } catch (error) {
      console.error("Google Drive upload error:", error.message);
      throw error;
    }
  }

  // Delete file from Google Drive
  static async deleteFile(fileIdOrUrl) {
    const driveClient = initializeDrive();
    if (!driveClient) {
      throw new Error("Google Drive not initialized");
    }

    // Extract file ID from URL if needed
    let fileId = fileIdOrUrl;
    if (fileIdOrUrl && fileIdOrUrl.includes("drive.google.com")) {
      const match =
        fileIdOrUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
        fileIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    }

    if (!fileId) {
      console.warn("No file ID provided for deletion");
      return;
    }

    try {
      await driveClient.files.delete({ fileId: fileId });
      console.log(`✅ Deleted from Google Drive: ${fileId}`);
    } catch (error) {
      console.error("Google Drive delete error:", error.message);
    }
  }

  static generateFileName(prefix, originalName) {
    const timestamp = Date.now();
    const extension = path.extname(originalName);
    const basename = path.basename(originalName, extension);
    const cleanBasename = basename.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${prefix}_${timestamp}_${cleanBasename}${extension}`;
  }
}

module.exports = GoogleDriveStorage;
