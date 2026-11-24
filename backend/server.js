
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { db, auth } = require("./config/firebase");

const app = express();

app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
  res.json({
    mensaje: "Backend de Pollería El Buen Sabor funcionando correctamente"
  });
});

// Comprobar conexión con Firebase
app.get("/api/estado", async (req, res) => {
  try {
    await db.collection("usuarios").limit(1).get();

    res.json({
      servidor: "Conectado",
      firebase: "Conectado",
      autenticacion: auth ? "Disponible" : "No disponible"
    });
  } catch (error) {
    console.error("Error de Firebase:", error);

    res.status(500).json({
      mensaje: "Error al conectar con Firebase",
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
