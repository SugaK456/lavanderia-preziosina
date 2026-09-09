const https = require("https");

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID;

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
    const machines = JSON.parse(res) || {};
    const now = Date.now();

    for (const [id, data] of Object.entries(machines)) {
      if (data && data.status === "busy" && data.busyUntil <= now) {
        console.log(`Macchina ${id} ha terminato. Invio avviso al gruppo WhatsApp...`);

        try {
          await sendWhatsAppGroupMessage(id);
          console.log(`Messaggio inviato con successo nel gruppo per la macchina ${id}.`);
        } catch (err) {
          console.error("Errore invio messaggio WhatsApp:", err);
        }

        // Resetta lo stato della macchina nel database su Libera
        const resetPayload = JSON.stringify({ status: "free", busyUntil: 0 });
        await httpRequest(`${FIREBASE_DB_URL}/machines/${id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" }
        }, resetPayload);

        console.log(`Macchina ${id} resettata su Firebase.`);
      }
    }
  } catch (err) {
    console.error("Errore esecuzione controllo:", err);
  }
}

run();
