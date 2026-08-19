// lib/whatsapp-report-helper.js
import fetch from "node-fetch";

const SENDER_NUMBER = "8700994288";

/**
 * Get Start and End of a given date in IST (Indian Standard Time, UTC+5:30)
 */
export function getISTDayRange(dateInput = new Date()) {
  const d = new Date(dateInput);
  const utcTime = d.getTime() + d.getTimezoneOffset() * 60000;
  const istTime = new Date(utcTime + 330 * 60000);

  const startOfDay = new Date(istTime);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(istTime);
  endOfDay.setHours(23, 59, 59, 999);

  const startUTC = new Date(startOfDay.getTime() - 330 * 60000);
  const endUTC = new Date(endOfDay.getTime() - 330 * 60000);

  const dateFormatted = istTime.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return { startUTC, endUTC, dateFormatted };
}

/**
 * Aggregates today's live payment and calls data from MongoDB
 */
export async function getDailyReportStats(db, targetDate = new Date()) {
  const { startUTC, endUTC, dateFormatted } = getISTDayRange(targetDate);
  const startISO = startUTC.toISOString();
  const endISO = endUTC.toISOString();

  // 1. Fetch Payments submitted today
  const paymentsQuery = {
    $or: [
      { createdAt: { $gte: startUTC, $lte: endUTC } },
      { createdAt: { $gte: startISO, $lte: endISO } },
      { date: { $gte: startISO.slice(0, 10), $lte: endISO.slice(0, 10) } },
    ],
  };

  const payments = await db.collection("payments").find(paymentsQuery).toArray();

  let totalCash = 0;
  let totalOnline = 0;
  let totalRevenue = 0;

  payments.forEach((p) => {
    const cash = Number(p.cashAmount || p.cash || 0) || 0;
    const online = Number(p.onlineAmount || p.online || 0) || 0;
    const combined = Number(p.totalCombined || p.amount || p.totalAmount || (cash + online)) || 0;

    totalCash += cash;
    totalOnline += online;
    totalRevenue += combined;
  });

  // 2. Fetch Forwarded Calls counts today
  const assignedTodayQuery = {
    $or: [
      { createdAt: { $gte: startUTC, $lte: endUTC } },
      { createdAt: { $gte: startISO, $lte: endISO } },
    ],
  };
  const totalAssignedToday = await db.collection("forwarded_calls").countDocuments(assignedTodayQuery);

  const closedTodayQuery = {
    status: { $in: ["Closed", "Completed"] },
    $or: [
      { closedAt: { $gte: startUTC, $lte: endUTC } },
      { closedAt: { $gte: startISO, $lte: endISO } },
      { updatedAt: { $gte: startUTC, $lte: endUTC } },
      { updatedAt: { $gte: startISO, $lte: endISO } },
      { createdAt: { $gte: startUTC, $lte: endUTC } },
      { createdAt: { $gte: startISO, $lte: endISO } },
    ],
  };
  const totalClosedToday = await db.collection("forwarded_calls").countDocuments(closedTodayQuery);

  const canceledTodayQuery = {
    status: { $in: ["Canceled", "Cancelled"] },
    $or: [
      { updatedAt: { $gte: startUTC, $lte: endUTC } },
      { updatedAt: { $gte: startISO, $lte: endISO } },
      { createdAt: { $gte: startUTC, $lte: endUTC } },
      { createdAt: { $gte: startISO, $lte: endISO } },
    ],
  };
  const totalCanceledToday = await db.collection("forwarded_calls").countDocuments(canceledTodayQuery);

  const totalPendingCalls = await db.collection("forwarded_calls").countDocuments({
    status: { $in: ["Pending", "In Process"] },
  });

  const stats = {
    dateFormatted,
    totalCash,
    totalOnline,
    totalRevenue,
    paymentsCount: payments.length,
    totalClosedToday,
    totalPendingCalls,
    totalCanceledToday,
    totalAssignedToday,
  };

  const formattedMessage = generateFormattedReportText(stats);

  return { stats, formattedMessage };
}

/**
 * Generates the clean, beautiful WhatsApp message string
 */
export function generateFormattedReportText(stats) {
  const formatCurrency = (val) =>
    "₹" + Number(val || 0).toLocaleString("en-IN");

  const text = `🌟 *CHIMNEY SOLUTIONS DAILY UPDATES* 🌟
📅 *Date:* ${stats.dateFormatted || "Today"} | 08:00 PM
━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *TOTAL SUBMITTED PAYMENT TODAY:*
• 💵 *Cash Collection:* ${formatCurrency(stats.totalCash)}
• 💳 *Online Collection:* ${formatCurrency(stats.totalOnline)}
• 💎 *Total Revenue:* ${formatCurrency(stats.totalRevenue)}
• 🧾 *Transactions:* ${stats.paymentsCount || 0} Submissions

📊 *CALLS SUMMARY TODAY:*
• ✅ *Closed Calls Today:* ${stats.totalClosedToday || 0}
• ⏳ *Pending Calls:* ${stats.totalPendingCalls || 0}
• ❌ *Canceled Calls Today:* ${stats.totalCanceledToday || 0}
• 📞 *Total Assigned Today:* ${stats.totalAssignedToday || 0}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 _Automated Daily CRM Report • Chimney Solutions_`;

  return text;
}

/**
 * Dispatches a WhatsApp Message to a phone number
 */
export async function sendWhatsAppMessageDirect(phone, messageText, stats = null) {
  let cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
  if (!cleanPhone.startsWith("+") && !cleanPhone.startsWith("91")) {
    cleanPhone = "91" + cleanPhone;
  }

  // Prevent sending to sender itself (Meta API limitation)
  const isSenderItself = cleanPhone.endsWith(SENDER_NUMBER);
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

  if (isSenderItself) {
    return {
      success: true,
      phone: cleanPhone,
      isSender: true,
      note: "8700994288 is the sender account. Use recipient numbers to receive API push or open directly via WhatsApp Web link.",
      waLink,
    };
  }

  try {
    const phoneWithPlus = cleanPhone.startsWith("+") ? cleanPhone : "+" + cleanPhone;

    const apiKey =
      process.env.WAPPBIZ_KEY ||
      "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

    const summaryParam = stats
      ? `Payment: ₹${stats.totalRevenue} (Cash: ₹${stats.totalCash} | Online: ₹${stats.totalOnline}) • Closed: ${stats.totalClosedToday} • Pending: ${stats.totalPendingCalls}`
      : "Daily CRM Updates Summary";

    const payload = {
      template_name: "service_registered",
      phone: phoneWithPlus,
      name: "Admin / Owner",
      parameters: `Admin, ${summaryParam}, ${stats?.dateFormatted || "Today"}`,
    };

    const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({ status: "sent_ok", ok: true }));

    return {
      success: !result.error,
      phone: cleanPhone,
      result,
      waLink,
    };
  } catch (err) {
    console.error("WhatsApp Dispatch Error:", err);
    return {
      success: false,
      error: err.message,
      phone: cleanPhone,
      waLink,
    };
  }
}
