import express from "express";
import db from "./db.js";

const app = express();
app.use(express.json());

app.get("/todos", (req, res) => {
  const todos = db.prepare("SELECT * FROM todos ORDER BY id DESC").all();
  res.json(todos);
});

app.post("/todos", (req, res) => {
  const { text } = req.body;

  db.prepare("INSERT INTO todos (text) VALUES (?)").run(text);

  res.json({ success: true });
});

export function startServer() {
  app.listen(3001, () => {
    console.log("Express + SQLite running");
  });
}
