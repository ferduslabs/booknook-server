import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./src/db.js";
import booksRouter from "./src/routes/books.js";
import borrowsRouter from "./src/routes/borrows.js";

const PORT = process.env.PORT || 5000;
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// health check
app.get("/", (req, res) => {
  res.json({ status: "BookNook API is running" });
});

app.use("/books", booksRouter);
app.use("/borrows", borrowsRouter);

// 404 - ভুল route
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
