// pages/api/tech/my-calls.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { getCache, setCache } from "../../../lib/redis.js";

/**
 * Returns forwarded calls for the logged-in technician.
 * Each item includes all forwarded call fields, closure metadata, paymentStatus.
 */

function normalizeForKey(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\d\s+,-]/g, "")
    .trim();
}

function normalizePhone(p = "") {
  return String(p || "").replace(/\D/g, "");
}

async function handler(req, res, user) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    let { tab = "All Calls", page = 1, pageSize } = req.query;
    page = parseInt(page, 10) || 1;
    pageSize = parseInt(pageSize, 10) || 50;

    const ALLOWED_TABS = new Set(["All Calls", "Today Calls", "Pending", "Closed", "Canceled"]);
    if (!ALLOWED_TABS.has(tab)) tab = "All Calls";

    // ⚡ Redis Cache Check
    const cacheKey = `tech:calls:${user.id}:${tab}:${page}:${pageSize}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "private, no-cache");
      return res.status(200).json(cachedData);
    }

    const db = await getDb();
    const forwardedColl = db.collection("forwarded_calls");
    const paymentsColl = db.collection("payments");

    const techIds = [user.id];
    if (ObjectId.isValid(user.id)) techIds.push(new ObjectId(user.id));

    const match = { techId: { $in: techIds } };

    if (tab === "Today Calls") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      match.createdAt = { $gte: start };
      match.status = { $ne: "Canceled" };
    } else if (tab === "Pending") {
      match.status = { $in: ["Pending", "In Process"] };
    } else if (tab === "Closed") {
      match.status = { $in: ["Closed", "Completed"] };
    } else if (tab === "Canceled") {
      match.status = { $in: ["Canceled", "Cancelled"] };
    }

    const skip = (page - 1) * pageSize;

    // Fetch total counts for all tabs concurrently
    const [totalCount, totalAll, totalPending, totalClosed, totalCanceled] = await Promise.all([
      forwardedColl.countDocuments(match),
      forwardedColl.countDocuments({ techId: { $in: techIds } }),
      forwardedColl.countDocuments({ techId: { $in: techIds }, status: { $in: ["Pending", "In Process"] } }),
      forwardedColl.countDocuments({ techId: { $in: techIds }, status: { $in: ["Closed", "Completed"] } }),
      forwardedColl.countDocuments({ techId: { $in: techIds }, status: { $in: ["Canceled", "Cancelled"] } }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    // Fetch forwarded calls slice
    const docs = await forwardedColl
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .project({
        clientName: 1,
        customerName: 1,
        name: 1,
        fullName: 1,
        phone: 1,
        mobile: 1,
        contact: 1,
        address: 1,
        addr: 1,
        location: 1,
        type: 1,
        serviceType: 1,
        price: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        closedAt: 1,
        closedBy: 1,
        closedByName: 1,
        timeZone: 1,
        notes: 1,
        paymentStatus: 1,
        chooseCall: 1,
        techName: 1,
      })
      .toArray();

    const hasMore = page < totalPages;
    const slice = docs;

    if (slice.length === 0) {
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).json({
        success: true,
        items: [],
        page,
        pageSize,
        totalCount,
        totalPages,
        hasMore: false,
        counts: {
          all: totalAll,
          pending: totalPending,
          closed: totalClosed,
          canceled: totalCanceled,
        },
      });
    }

    // Build arrays to query payments efficiently
    const callIdsAll = slice.map((c) => String(c._id));
    const pricesSet = Array.from(new Set(slice.map((c) => Number(c.price || 0))));

    const paymentsQuery = {
      $or: [
        { "calls.callId": { $in: callIdsAll } },
        { techId: { $in: techIds }, "calls.price": { $in: pricesSet } },
      ],
    };

    const payments = await paymentsColl.find(paymentsQuery).project({ calls: 1, mode: 1, receiver: 1, createdAt: 1 }).toArray();

    const paidByCallId = new Map();
    const paidKeyWithPrice = new Map();

    for (const pay of payments) {
      if (!pay || !Array.isArray(pay.calls)) continue;
      for (const pc of pay.calls) {
        if (!pc) continue;
        const callAmt = Number(pc.onlineAmount || 0) + Number(pc.cashAmount || 0) || Number(pc.price || 0);
        if (pc.callId) paidByCallId.set(String(pc.callId), { paidAmount: callAmt, mode: pay.mode, receiver: pay.receiver });
        const name = normalizeForKey(pc.clientName || pc.name || "");
        const phone = normalizePhone(pc.phone || pc.mobile || pc.contact || "");
        const address = normalizeForKey(pc.address || pc.addr || pc.location || "");
        const price = Number(pc.price || pc.amount || pc.total || 0);
        if (name || phone || address || price) {
          const key = `${name}|${phone}|${address}|${price}`;
          paidKeyWithPrice.set(key, { paidAmount: callAmt, mode: pay.mode, receiver: pay.receiver });
        }
      }
    }

    const items = slice.map((i) => {
      const clientName = i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "Unknown";
      const phone = i.phone ?? i.mobile ?? i.contact ?? "";
      const address = i.address ?? i.addr ?? i.location ?? "";
      const price = Number(i.price || 0);
      const key = `${normalizeForKey(clientName)}|${normalizePhone(phone)}|${normalizeForKey(address)}|${price}`;

      const matchedPay = paidByCallId.get(String(i._id)) || paidKeyWithPrice.get(key) || null;
      const isPaid = Boolean(matchedPay) || (i.paymentStatus && String(i.paymentStatus).toLowerCase().includes("paid"));

      const chooseRaw = i.chooseCall ?? "";
      const chooseLabel =
        String(chooseRaw || "")
          .replace(/_/g, " ")
          .replace(/\s+/g, " ")
          .trim() || "";

      return {
        _id: String(i._id),
        clientName,
        phone,
        address,
        type: i.type || i.serviceType || "Service Job",
        price,
        status: i.status ?? "Pending",
        createdAt: i.createdAt ?? "",
        updatedAt: i.updatedAt ?? "",
        closedAt: i.closedAt ?? null,
        closedByName: i.closedByName || i.techName || "",
        timeZone: i.timeZone ?? "",
        notes: i.notes ?? "",
        paymentStatus: isPaid ? "Paid" : "Pending",
        paidAmount: matchedPay?.paidAmount || 0,
        paymentMode: matchedPay?.mode || "",
        receiver: matchedPay?.receiver || "",
        chooseCall: chooseRaw,
        chooseLabel,
        techName: i.techName ?? "",
      };
    });

    const responsePayload = {
      success: true,
      items,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasMore,
      counts: {
        all: totalAll,
        pending: totalPending,
        closed: totalClosed,
        canceled: totalCanceled,
      },
    };

    await setCache(cacheKey, responsePayload, 60);

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "private, no-cache");
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("my-calls error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
