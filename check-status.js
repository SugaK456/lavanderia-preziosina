const https = require("https");

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function httpRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, data: body }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sendWhatsAppGroupMessage(machineId) {
  const url = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`;
  const payload = JSON.stringify({
    chatId: WHATSAPP_GROUP_ID,
    message: `🧺 *LAVANDERIA*\n\nLa macchina *${machineId}* ha terminato il ciclo ed è ora *LIBERA* per il prossimo utilizzo!`
  });

  return httpRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  }, payload);
}

async function run() {
  try {
    const res = await httpRequest(`${FIREBASE_DB_URL}/machines.json`, { method: "GET" });
    const machines = JSON.parse(res.data) || {};
    const now = Date.now();

    for (const [id, data] of Object.entries(machines)) {
      if (data && data.status === "busy" && data.busyUntil <= now) {
        console.log(`Elaborazione macchina ${id}...`);

        // 1. Reset immediato dello stato su Firebase
        const resetPayload = JSON.stringify({ status: "free", busyUntil: 0 });
        await httpRequest(`${FIREBASE_DB_URL}/machines/${id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" }
        }, resetPayload);
        console.log(`Macchina ${id} resettata su Firebase.`);

        // 2. Invio avviso nel gruppo WhatsApp
        try {
          const response = await sendWhatsAppGroupMessage(id);
          console.log(`Stato invio WhatsApp per ${id}:`, response.status, response.data);
        } catch (err) {
          console.error(`Errore invio WhatsApp per ${id}:`, err);
        }

        // 3. Attesa di 3 secondi prima di processare l'eventuale macchina successiva
        await sleep(3000);
      }
    }
  } catch (err) {
    console.error("Errore generale esecuzione:", err);
  }
}

run();
