// lib/sendNotification.js
import admin, { sendNotification as sendFCMNotification, sendNotificationToTokens } from "./firebaseAdmin.js";

export { admin, sendNotificationToTokens };

export async function sendNotification(token, title, body, data = {}, url = "/tech/calls") {
  return sendFCMNotification(token, title, body, data, url);
}

export default sendNotification;
