// lib/whatsapp-scheduler.js
import { getDb } from "./api-helpers.js";
import { getDailyReportStats, sendWhatsAppMessageDirect } from "./whatsapp-report-helper.js";

let schedulerInterval = null;

/**
 * Get accurate current date and time in Indian Standard Time (IST, UTC+5:30)
 */
export function getISTDateInfo() {
  const d = new Date();
  const utcTime = d.getTime() + d.getTimezoneOffset() * 60000;
  const istTime = new Date(utcTime + 330 * 60000);

  const hours = String(istTime.getHours()).padStart(2, "0");
  const minutes = String(istTime.getMinutes()).padStart(2, "0");
  const currentHM = `${hours}:${minutes}`;

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

  return { istTime, currentHM, dateFormatted, timeFormatted };
}

/**
 * Checks configured schedule times for active recipients and dispatches WhatsApp reports if due
 */
export async function checkAndDispatchScheduledReports(forceAll = false) {
  try {
    const db = await getDb();
    const settings = await db.collection("whatsapp_report_settings").findOne({ key: "daily_8pm_report" });

    if (!settings) {
      return { ok: true, status: "no_settings" };
    }

    if (!forceAll && settings.autoSend === false) {
      return { ok: true, status: "auto_send_disabled" };
    }

    const { currentHM, dateFormatted } = getISTDateInfo();
    const rawList = Array.isArray(settings.recipients) ? settings.recipients : [];
    const masterTime = settings.sendTime || "20:00";

    const eligibleRecipients = rawList
      .slice(0, 4) // Max 4 recipients
      .map((r, i) => {
        if (typeof r === "object" && r !== null) {
          return {
            phone: String(r.phone || "").replace(/[^0-9]/g, ""),
            label: r.label || `Recipient ${i + 1}`,
            time: r.time || masterTime,
            active: r.active !== false,
          };
        }
        return {
          phone: String(r || "").replace(/[^0-9]/g, ""),
          label: `Recipient ${i + 1}`,
          time: masterTime,
          active: true,
        };
      })
      .filter((r) => r.phone.length >= 10 && r.active);

    if (eligibleRecipients.length === 0) {
      return { ok: true, status: "no_active_recipients" };
    }

    const toSend = [];

    for (const rec of eligibleRecipients) {
      const scheduledTime = rec.time || masterTime;

      if (forceAll) {
        toSend.push(rec);
      } else if (scheduledTime === currentHM) {
        // Prevent duplicate dispatch: check if sent in last 45 minutes to this recipient
        const recentLog = await db.collection("whatsapp_report_logs").findOne({
          phone: rec.phone,
          type: "automated_cron_daily",
          createdAt: { $gte: new Date(Date.now() - 45 * 60 * 1000) },
        });

        if (!recentLog) {
          toSend.push(rec);
        } else {
          // Already sent recently
        }
      }
    }

    if (toSend.length === 0) {
      return { ok: true, status: "no_pending_dispatches", currentHM };
    }

    console.log(`⏰ [WhatsApp Scheduler] Dispatching ${toSend.length} report(s) at ${currentHM} IST...`);

    const { stats, formattedMessage } = await getDailyReportStats(db);
    const results = [];

    for (const rec of toSend) {
      const dispatchResult = await sendWhatsAppMessageDirect(rec.phone, formattedMessage, stats);

      await db.collection("whatsapp_report_logs").insertOne({
        phone: rec.phone,
        label: rec.label,
        status: dispatchResult.success ? "sent" : "failed",
        error: dispatchResult.error || null,
        apiResult: dispatchResult.result || null,
        message: formattedMessage,
        stats,
        dateFormatted,
        scheduledTime: rec.time || masterTime,
        type: "automated_cron_daily",
        triggeredBy: forceAll ? "manual_cron_trigger" : "background_scheduler",
        createdAt: new Date(),
      });

      results.push({
        phone: rec.phone,
        label: rec.label,
        scheduledTime: rec.time || masterTime,
        success: dispatchResult.success,
      });

      console.log(`✅ [WhatsApp Scheduler] Report sent to ${rec.label} (${rec.phone}) - status: ${dispatchResult.success ? "OK" : "FAILED"}`);
    }

    return {
      ok: true,
      status: "dispatched",
      count: results.length,
      currentHM,
      results,
    };
  } catch (err) {
    console.error("❌ [WhatsApp Scheduler] Error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Initializes the background recurring scheduler (runs every 20 seconds)
 */
export function initWhatsAppScheduler() {
  if (global.__whatsappReportSchedulerStarted) {
    return;
  }
  global.__whatsappReportSchedulerStarted = true;
  console.log("🚀 [WhatsApp Scheduler] Background Auto-Dispatch Service Initialized (Checking every 20s)");

  // Run initial check after 2 seconds
  setTimeout(() => {
    checkAndDispatchScheduledReports().catch(() => {});
  }, 2000);

  // Set recurring check every 20 seconds
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(() => {
    checkAndDispatchScheduledReports().catch((err) => {
      console.error("[WhatsApp Scheduler] Tick error:", err);
    });
  }, 20000);
}
