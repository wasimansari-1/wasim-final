// pages/api/tech/payment.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { delPattern } from "../../../lib/redis.js";

/** helpers **/
function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function escapeRegExp(string = "") {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normKey(clientName = "", phone = "", address = "", price = 0) {
  return `${String(clientName || "").toLowerCase().trim()}|${String(phone || "").replace(/\D/g, "")}|${String(address || "").toLowerCase().trim()}|${safeNumber(price)}`;
}
const CLOSED_STATUS_REGEX = /closed|completed|done|resolved|finished/i;

/**
 * POST /api/tech/payment
 * - Strict: only closed forwarded_calls may be marked Paid
 * - Prevent duplicate payments: rejects if any targeted forwarded_call is already Paid
 * - Batched lookups for speed, single bulkWrite for updates
 */
async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const {
      receiver,
      mode,
      onlineAmount = 0,
      cashAmount = 0,
      receiverSignature,
      calls = [],
    } = body;

    // basic shaped validation
    if (!receiver || typeof receiver !== "string" || !receiver.trim()) {
      return res.status(400).json({ success: false, error: "Receiver (paying name) is required" });
    }
    if (!receiverSignature || typeof receiverSignature !== "string") {
      return res.status(400).json({ success: false, error: "Receiver signature is required (base64/dataURL)" });
    }
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({ success: false, error: "At least one call must be provided" });
    }

    const db = await getDb();
    const paymentsColl = db.collection("payments");
    const callsColl = db.collection("forwarded_calls");

    // tech info
    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;
    const techUsername = user.username || user.email || user.name || null;

    const online = safeNumber(onlineAmount);
    const cash = safeNumber(cashAmount);
    const total = online + cash;

    // normalize & dedupe input calls (by callId if present, else by normalized key)
    const seen = new Set();
    const storedCalls = [];
    for (const c of calls) {
      const callId = c.callId ? String(c.callId) : null;
      const clientName = c.clientName ? String(c.clientName) : "";
      const phone = c.phone ? String(c.phone) : "";
      const address = c.address ? String(c.address) : "";
      const price = safeNumber(c.price);
      const onlineA = safeNumber(c.onlineAmount);
      const cashA = safeNumber(c.cashAmount);

      const key = callId ? `id:${callId}` : normKey(clientName, phone, address, price);
      if (seen.has(key)) continue;
      seen.add(key);

      storedCalls.push({
        callId,
        clientName,
        phone,
        address,
        type: c.type ? String(c.type) : "",
        price,
        onlineAmount: onlineA,
        cashAmount: cashA,
      });
    }

    // Early check: total amounts must sum to provided totals (optional but useful)
    // (Not strictly necessary if backend only trusts per-call amounts, but keep as sanity)
    const sumPayload = storedCalls.reduce((s, x) => s + Number(x.onlineAmount || 0) + Number(x.cashAmount || 0), 0);
    if (sumPayload !== total) {
      // don't block — still allow, but warn (to be strict, we can reject)
      // We'll reject to be consistent with previous strict behavior.
      return res.status(400).json({ success: false, error: `Sum of per-call amounts (₹${sumPayload}) doesn't equal total (₹${total})` });
    }

    // Separate calls with callId and without
    const withId = storedCalls.filter((s) => s.callId);
    const withoutId = storedCalls.filter((s) => !s.callId);

    // ---------- BATCH FETCH FOR callId entries ----------
    const problemAlreadyPaid = [];
    const problemNotFound = [];
    const problemNotClosed = [];
    const problemPriceMismatch = [];

    const callIdObjIds = [];
    const callIdStrs = [];
    for (const s of withId) {
      if (ObjectId.isValid(s.callId)) callIdObjIds.push(new ObjectId(s.callId));
      else callIdStrs.push(s.callId);
    }

    if (callIdObjIds.length || callIdStrs.length) {
      const q = [];
      if (callIdObjIds.length) q.push({ _id: { $in: callIdObjIds } });
      if (callIdStrs.length) q.push({ _id: { $in: callIdStrs } });
      const found = await callsColl
        .find({ $or: q })
        .project({ _id: 1, price: 1, status: 1, paymentStatus: 1 })
        .toArray();

      const foundMap = new Map(found.map((f) => [String(f._id), f]));

      for (const sc of withId) {
        const f = foundMap.get(String(sc.callId));
        if (!f) {
          problemNotFound.push(sc.callId);
          continue;
        }
        // price check
        const expected = safeNumber(f.price);
        const entered = Number(sc.onlineAmount || 0) + Number(sc.cashAmount || 0);
        if (entered !== expected) {
          problemPriceMismatch.push({ callId: sc.callId, expected, entered });
        }
        // closed check
        const status = f.status || "";
        if (!CLOSED_STATUS_REGEX.test(status)) {
          problemNotClosed.push({ callId: sc.callId, status });
        }
        // already paid
        if (String(f.paymentStatus || "").toLowerCase() === "paid") {
          problemAlreadyPaid.push(String(f._id));
        }
      }
    }

    // ---------- BATCH FETCH FOR non-callId entries ----------
    // Build OR filters (one per stored sc) to fetch possible matching forwarded_calls in one query
    let matchedDocsForNoId = [];
    if (withoutId.length) {
      const orFilters = [];
      for (const sc of withoutId) {
        const clauses = [];
        if (sc.clientName) clauses.push({ clientName: { $regex: new RegExp(escapeRegExp(sc.clientName), "i") } });
        if (sc.phone) clauses.push({ phone: { $regex: new RegExp(escapeRegExp(sc.phone), "i") } });
        if (sc.address) clauses.push({ address: { $regex: new RegExp(escapeRegExp(sc.address), "i") } });
        if (clauses.length === 0) continue;
        orFilters.push({
          $and: [
            { $or: clauses },
            { price: sc.price },
          ],
        });
      }
      if (orFilters.length) {
        matchedDocsForNoId = await callsColl
          .find({ $or: orFilters })
          .project({ _id: 1, price: 1, status: 1, paymentStatus: 1, clientName: 1, phone: 1, address: 1 })
          .toArray();
      }
      // analyze matches: if any matched doc is already Paid or not closed => flag
      for (const doc of matchedDocsForNoId) {
        if (String(doc.paymentStatus || "").toLowerCase() === "paid") {
          problemAlreadyPaid.push(String(doc._id));
        } else if (!CLOSED_STATUS_REGEX.test(doc.status || "")) {
          problemNotClosed.push({ id: String(doc._id), status: doc.status || "" });
        }
      }
    }

    // If there are any blocking problems, reject early with 409/400
    if (problemAlreadyPaid.length) {
      return res.status(409).json({
        success: false,
        error: "Some calls are already marked Paid. Preventing duplicate payment submission.",
        paidCallIds: problemAlreadyPaid,
      });
    }
    if (problemNotFound.length) {
      return res.status(400).json({
        success: false,
        error: "Some provided callIds were not found",
        notFoundCallIds: problemNotFound,
      });
    }
    if (problemPriceMismatch.length) {
      return res.status(400).json({
        success: false,
        error: "Price mismatch for some calls",
        mismatches: problemPriceMismatch,
      });
    }
    if (problemNotClosed.length) {
      return res.status(400).json({
        success: false,
        error: "Some calls are not in closed/completed status and therefore cannot be paid",
        notClosed: problemNotClosed,
      });
    }

    // ---------- All validations passed -> create payment doc ----------
    const paymentDoc = {
      techId,
      techUsername,
      receiver: String(receiver).trim(),
      mode: mode ? String(mode) : "",
      onlineAmount: online,
      cashAmount: cash,
      totalAmount: total,
      receiverSignature: receiverSignature,
      calls: storedCalls,
      createdAt: new Date(),
      createdBy: {
        _id: user._id || user.id || null,
        username: techUsername,
      },
    };

    const insertResult = await paymentsColl.insertOne(paymentDoc);
    const paymentId = insertResult.insertedId ? String(insertResult.insertedId) : null;

    // ---------- Build bulk ops (only closed + not already paid) ----------
    const bulkOps = [];
    const updatedCallIds = [];
    const updatedByNamePhoneMatches = [];

    // for callId entries
    for (const sc of storedCalls.filter((s) => s.callId)) {
      let filter;
      if (ObjectId.isValid(sc.callId)) filter = { _id: new ObjectId(sc.callId) };
      else filter = { _id: sc.callId };

      // additional safety: only update if not already Paid and status closed
      filter.$and = [
        { $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: { $ne: "Paid" } }] },
        { status: { $regex: "closed|completed|done|resolved|finished", $options: "i" } },
      ];

      bulkOps.push({
        updateOne: {
          filter,
          update: {
            $set: { paymentStatus: "Paid", paymentRef: paymentId, paymentAt: new Date() },
            $push: {
              payments: {
                paymentId,
                onlineAmount: sc.onlineAmount,
                cashAmount: sc.cashAmount,
                createdAt: new Date(),
                recordedBy: techUsername,
              },
            },
          },
        },
      });
      updatedCallIds.push(sc.callId);
    }

    // for non-callId entries -> updateMany with OR clauses + price + closed + not-paid
    for (const sc of storedCalls.filter((s) => !s.callId)) {
      const clauses = [];
      if (sc.clientName) clauses.push({ clientName: { $regex: new RegExp(escapeRegExp(sc.clientName), "i") } });
      if (sc.phone) clauses.push({ phone: { $regex: new RegExp(escapeRegExp(sc.phone), "i") } });
      if (sc.address) clauses.push({ address: { $regex: new RegExp(escapeRegExp(sc.address), "i") } });

      if (clauses.length === 0) continue;

      const filter = {
        $and: [
          { $or: clauses },
          { price: safeNumber(sc.price) },
          { status: { $regex: "closed|completed|done|resolved|finished", $options: "i" } },
          { $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: { $ne: "Paid" } }] },
        ],
      };

      bulkOps.push({
        updateMany: {
          filter,
          update: {
            $set: { paymentStatus: "Paid", paymentRef: paymentId, paymentAt: new Date() },
            $push: {
              payments: {
                paymentId,
                onlineAmount: sc.onlineAmount,
                cashAmount: sc.cashAmount,
                createdAt: new Date(),
                recordedBy: techUsername,
              },
            },
          },
        },
      });

      updatedByNamePhoneMatches.push({ name: sc.clientName, phone: sc.phone, address: sc.address, price: sc.price });
    }

    // ---------- Execute bulkWrite (if ops present) ----------
    let updatedCount = 0;
    if (bulkOps.length > 0) {
      try {
        const bulkResult = await callsColl.bulkWrite(bulkOps, { ordered: false });
        updatedCount = (bulkResult.modifiedCount ?? 0) + (bulkResult.nModified ?? 0);
      } catch (bulkErr) {
        // partial failures may occur; log and continue - payment doc is already inserted
        console.error("bulkWrite error:", bulkErr);
      }
    }

    // Invalidate Redis caches
    delPattern("tech:calls:*").catch(() => {});
    delPattern("tech:payment-check:*").catch(() => {});
    delPattern("admin:payments:*").catch(() => {});
    delPattern("admin:summary:*").catch(() => {});

    return res.status(200).json({
      success: true,
      paymentId,
      updatedCallIds,
      updatedByNamePhoneMatches,
      updatedCount,
    });
  } catch (err) {
    console.error("tech/payment error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
