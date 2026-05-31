
const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit"); 
const cors = require("cors");

const app = express();

// --- Security: validate required env vars at startup ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("FATAL: OPENAI_API_KEY environment variable is not set. Exiting.");
  process.exit(1);
}

// --- Security: HTTP headers via helmet ---
app.use(helmet());

// --- Security: CORS – restrict to allowed origins ---
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];
app.use(
  cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
    methods: ["POST"],
  })
);

// --- Security: rate limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente mais tarde." },
});
app.use(limiter);

// --- Security: limit request body size ---
app.use(express.json({ limit: "10kb" }));

// --- Input sanitization helper ---
function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>]/g, "") // strip basic HTML/script tags
    .trim()
    .slice(0, 2000); // enforce max length
}

// --- Webhook endpoint ---
app.post("/webhook", async (req, res) => {
  const rawMessage = req.body?.message;

  if (!rawMessage || typeof rawMessage !== "string" || rawMessage.trim().length === 0) {
    return res.status(400).json({ error: "Mensagem não encontrada ou inválida." });
  }

  const message = sanitizeInput(rawMessage);

  try {
    const gptResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30s timeout to avoid hanging requests
      }
    );

    const reply = gptResponse.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: "Resposta vazia do ChatGPT." });
    }

    return res.json({ reply });
  } catch (err) {
    // Security: do NOT leak API error details to the client or logs
    const status = err.response?.status || 500;
    console.error("Erro ao consultar ChatGPT:", {
      status,
      message: err.message,
    });
    return res.status(status >= 500 ? 502 : status).json({
      error: "Erro ao consultar o ChatGPT. Tente novamente mais tarde.",
    });
  }
});

// --- Health check endpoint ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- 404 for unknown routes ---
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
