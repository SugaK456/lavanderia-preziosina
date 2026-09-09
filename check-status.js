const https = require("https");

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

function httpRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  try {
    const res = await httpRequest(`${FIREBASE_DB_URL}/machines.json`, { method: "GET" });
    const machines = JSON.parse(res) || {};
    const now = Date.now();

    for (const [id, data] of Object.entries(machines)) {
      if (data && data.status === "busy" && data.busyUntil <= now) {
        console.log(`Macchina ${id} ha terminato. Invio notifica...`);

        const payload = JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          contents: { it: `La macchina ${id} ha terminato il ciclo ed è libera!`, en: `Machine ${id} is now free!` },
          headings: { it: "🧺 Lavanderia", en: "🧺 Laundry" },
          filters: [{ field: "tag", key: `waiting_${id}`, relation: "=", value: "true" }]
        });

        await httpRequest("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
          }
        }, payload);

        // Resetta lo stato nel database
        const resetPayload = JSON.stringify({ status: "free", busyUntil: 0 });
        await httpRequest(`${FIREBASE_DB_URL}/machines/${id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" }
        }, resetPayload);

        console.log(`Macchina ${id} resettata.`);
      }
    }
  } catch (err) {
    console.error("Errore esecuzione:", err);
  }
}

run();