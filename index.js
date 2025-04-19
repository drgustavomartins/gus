
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).send({ error: "Mensagem não encontrada" });
  }

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
      }
    );

    const reply = gptResponse.data.choices[0].message.content.trim();
    return res.send({ reply });

  } catch (err) {
    console.error("Erro ao consultar ChatGPT:", err.response?.data || err.message);
    return res.status(500).send({ error: "Erro ao consultar o ChatGPT" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
