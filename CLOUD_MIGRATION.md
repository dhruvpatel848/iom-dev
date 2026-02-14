# Cloud Storage Migration Guide (Cloudinary)

This guide explains how to migrate your IOMCMS application from local file storage or AWS S3 to Cloudinary.

## Prerequisites

1. Cloudinary Account
2. Cloudinary Cloud Name, API Key, and API Secret

## Setup Steps

### 1. Create Cloudinary Account

- Sign up at [Cloudinary](https://cloudinary.com/)
- Go to Dashboard to find your:
  - Cloud Name
  - API Key
  - API Secret

### 2. Configure Environment Variables

- Update your `.env` file with the following keys:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Remove AWS S3 Keys if strictly not needed anymore
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=...
# AWS_S3_BUCKET_NAME=...
```

### 3. Install Dependencies

The Cloudinary SDK and Axios have been installed.

```bash
npm install cloudinary axios
```

### 4. Migration Notes

- **Uploads**: All new uploads will go to Cloudinary.
- **Access**: Files are accessed via secure Cloudinary URLs.
- **Security**: By default, uploads are public but with unguessable URLs. For strict privacy, advanced Cloudinary configuration (Authenticated access) is required, which involves enabling "Signed URLs" in Cloudinary settings and updating the code to request signature-based URLs.

### 5. Troubleshooting

- **Error downloading template**: Ensure the `file_path` in the database is a valid accessible URL.
- **Upload failures**: Check API keys in `.env`.
