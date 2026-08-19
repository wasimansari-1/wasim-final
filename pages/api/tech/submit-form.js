// pages/api/tech/submit-form.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { delPattern } from "../../../lib/redis.js";

function normalizePhone(p) {
  if (p == null) return "";
  const onlyDigits = String(p).replace(/\D+/g, "");
  return onlyDigits.slice(-15);
}

function normalizeText(s) {
  if (s == null) return "";
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikePublicUrl(u) {
  if (!u || typeof u !== "string") return false;
  return /^(\/uploads\/|https?:\/\/)/i.test(u);
}

function looksLikeDataUrl(d) {
  if (!d || typeof d !== "string") return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,/.test(d);
}

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const {
      clientName,
      address,
      payment = 0,
      phone,
      status = "Services Done",
      signature = null,
      stickerUrl = null,
      callId = null,
    } = req.body || {};

    if (!clientName || !address || !phone) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Customer Name, Address, and Phone are required.",
      });
    }

    const clientNameStr = String(clientName).trim().slice(0, 200);
    const addressStr = String(address).trim().slice(0, 1000);
    const phoneNorm = normalizePhone(phone);
    const paymentNum = Number(payment) || 0;
    const statusStr = String(status || "Services Done").slice(0, 80);

    let signatureToStore = null;
    if (signature) {
      if (looksLikeDataUrl(signature) || looksLikePublicUrl(signature)) {
        signatureToStore = signature;
      }
    }

    let stickerUrlToStore = null;
    if (stickerUrl && (looksLikePublicUrl(stickerUrl) || looksLikeDataUrl(stickerUrl))) {
      stickerUrlToStore = String(stickerUrl).trim();
    }

    const clientNameNorm = normalizeText(clientNameStr);
    const addressNorm = normalizeText(addressStr);
    const dayKey = new Date().toISOString().slice(0, 10);

    const db = await getDb();
    const forms = db.collection("service_forms");
    const forwardedColl = db.collection("forwarded_calls");

    const filter = {
      techId: user.id,
      dayKey,
      clientNameNorm,
      phoneNorm,
      payment: paymentNum,
    };

    const docOnInsert = {
      techId: user.id,
      techUsername: user.username || null,
      clientName: clientNameStr,
      address: addressStr,
      phone: String(phone).trim(),
      payment: paymentNum,
      status: statusStr,
      signature: signatureToStore,
      stickerUrl: stickerUrlToStore,
      callId: callId || null,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      dayKey,
      createdAt: new Date(),
      userAgent: req.headers["user-agent"] || null,
      ip: req.headers["x-forwarded-for"] || req.connection?.remoteAddress || null,
    };

    const result = await forms.updateOne(
      filter,
      { $setOnInsert: docOnInsert },
      { upsert: true }
    );

    // If a callId was attached, automatically mark that call as Closed
    if (callId) {
      try {
        const callObjId = ObjectId.isValid(callId) ? new ObjectId(callId) : callId;
        await forwardedColl.updateOne(
          { _id: callObjId },
          {
            $set: {
              status: "Closed",
              closedAt: new Date(),
              closedBy: user.id,
              closedByName: user.username || "technician",
              serviceFormSubmitted: true,
              updatedAt: new Date(),
            },
          }
        );
      } catch (callErr) {
        console.warn("Auto-close call on form submit warning:", callErr);
      }
    }

    res.setHeader("Cache-Control", "private, no-store");

    // Invalidate Redis caches
    delPattern("admin:forms:*").catch(() => {});
    delPattern("admin:summary:*").catch(() => {});

    let insertedId = "";
    if (result.upsertedId) {
      insertedId = String(result.upsertedId._id || result.upsertedId);
    }

    return res.status(200).json({
      ok: true,
      success: true,
      id: insertedId,
      message: "Service form submitted successfully.",
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({
        ok: true,
        success: true,
        message: "Form already submitted for today.",
      });
    }

    console.error("Service form create error:", error);
    return res
      .status(500)
      .json({ ok: false, success: false, message: "Failed to submit service form." });
  }
}

export default requireRole("technician")(handler);
