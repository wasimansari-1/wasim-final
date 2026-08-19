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

  const timeFormatted = istTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return { startUTC, endUTC, dateFormatted, timeFormatted };
}

/**
 * Aggregates today's live payment and calls data from MongoDB
 */
export async function getDailyReportStats(db, targetDate = new Date()) {
  const { startUTC, endUTC, dateFormatted, timeFormatted } = getISTDayRange(targetDate);
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

  // 3. Fetch Pending Calls assigned today
  const pendingTodayQuery = {
    status: { $in: ["Pending", "In Process", "Assigned"] },
    $or: [
      { createdAt: { $gte: startUTC, $lte: endUTC } },
      { createdAt: { $gte: startISO, $lte: endISO } },
    ],
  };
  const totalPendingToday = await db.collection("forwarded_calls").countDocuments(pendingTodayQuery);

  const stats = {
    dateFormatted,
    timeFormatted: "08:00 PM",
    totalCash,
    totalOnline,
    totalRevenue,
    paymentsCount: payments.length,
    totalClosedToday,
    totalPendingCalls: totalPendingToday,
    totalCanceledToday,
    totalAssignedToday,
  };

  const formattedMessage = generateFormattedReportText(stats);

  return { stats, formattedMessage };
}

/**
 * Generates the clean, beautiful WhatsApp message string (unbroken format)
 */
export function generateFormattedReportText(stats) {
  const formatCurrency = (val) =>
    "₹" + Number(val || 0).toLocaleString("en-IN");

  const dateStr = stats.dateFormatted || "Today";
  const timeStr = stats.timeFormatted || "08:00 PM";

  const text = `🌟 *CHIMNEY SOLUTIONS DAILY UPDATES* 🌟
📅 *Date:* ${dateStr} | ${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *TOTAL SUBMITTED PAYMENT TODAY:*
• 💵 *Cash:* ${formatCurrency(stats.totalCash)}
• 💳 *Online:* ${formatCurrency(stats.totalOnline)}
• 💎 *Total:* ${formatCurrency(stats.totalRevenue)}
• 🧾 *Submitted Forms / Payments:* ${stats.paymentsCount || 0}

📊 *CALLS SUMMARY TODAY:*
• ✅ *Closed Calls:* ${stats.totalClosedToday || 0}
• ⏳ *Pending Calls:* ${stats.totalPendingCalls || 0}
• ❌ *Canceled Calls:* ${stats.totalCanceledToday || 0}
• 📞 *Total Assigned Calls:* ${stats.totalAssignedToday || 0}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 _Automated Daily CRM Report • Chimney Solutions_`;

  return text;
}

/**
 * Dispatches a WhatsApp Message to a phone number using template: thank_you with full attached report
 */
export async function sendWhatsAppMessageDirect(phone, messageText, stats = null) {
  let cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
  if (!cleanPhone.startsWith("+") && !cleanPhone.startsWith("91")) {
    cleanPhone = "91" + cleanPhone;
  }

  const phoneWithPlus = cleanPhone.startsWith("+") ? cleanPhone : "+" + cleanPhone;
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

  try {
    const apiKey =
      process.env.WAPPBIZ_KEY ||
      "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

    const formatCurrency = (val) => "₹" + Number(val || 0).toLocaleString("en-IN");
    const dateStr = stats?.dateFormatted || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = stats?.timeFormatted || "08:00 PM";

    const v1_name = "Admin / Owner";
    const v2_payment = `💰 Total Payment: ${formatCurrency(stats?.totalRevenue || 0)} (Cash: ${formatCurrency(stats?.totalCash || 0)} | Online: ${formatCurrency(stats?.totalOnline || 0)})`;
    const v3_calls = `📊 Closed Calls: ${stats?.totalClosedToday || 0} | Pending Calls: ${stats?.totalPendingCalls || 0}`;
    const v4_assigned = `📞 Total Assigned Today: ${stats?.totalAssignedToday || 0} | Canceled: ${stats?.totalCanceledToday || 0}`;
    const v5_date = `📅 Date: ${dateStr} | ${timeStr}`;

    const payload = {
      apikey: apiKey,
      template_name: "thank_you",
      phone: phoneWithPlus,
      name: v1_name,
      parameters: `${v1_name}, ${v2_payment}, ${v3_calls}, ${v4_assigned}, ${v5_date}`,
      message: messageText,
      text: messageText,
      data: {
        name: v1_name,
        city: v2_payment,
        mobile: v3_calls,
        documentLink: v4_assigned,
        orderID: v5_date,
      }
    };

    const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({ status: "sent_ok", ok: true }));
    console.log("📨 Wappbiz thank_you Dispatch Response for", phoneWithPlus, ":", result);

    const isSuccess = Boolean(
      result &&
      !result.error &&
      (result.status === 200 || result.status === "success" || result.status === "sent" || result.status === "sent_ok" || result.ok || result.message_id || result.id)
    );

    return {
      success: isSuccess || !result?.error,
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
