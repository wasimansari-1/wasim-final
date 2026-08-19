// pages/api/tech/upload-sticker.js
import { v2 as cloudinary } from "cloudinary";

const CLOUD_NAME = "dewrvzgmt";
const API_KEY = "834954975913379";
const API_SECRET = "fss1aZPC_gdZeK09On_pwHBCKhY";

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "30mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, error: "Image not received" });
    }

    // Fast Single-Pass Upload with automatic WebP compression
    const uploadOptions = {
      folder: "chimney_stickers",
      resource_type: "image",
      format: "webp",
      transformation: [
        { width: 800, crop: "limit" },
        { quality: "auto:eco" },
      ],
      fetch_format: "auto",
      exif: false,
    };

    const result = await cloudinary.uploader.upload(imageBase64, uploadOptions);

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      sizeKB: Math.round((result.bytes || 0) / 1024),
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Image upload failed",
    });
  }
}
