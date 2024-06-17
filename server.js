const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const dbPath = path.resolve(__dirname, "users.db");

// Проверка существования директории и её создание, если её нет
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Ошибка при открытии базы данных:", err.message);
  } else {
    console.log("Успешное подключение к базе данных");
  }
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Создание таблицы, если она не существует
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT, code TEXT, balance REAL)"
  );

  // Проверка наличия колонки code и добавление, если отсутствует
  db.all("PRAGMA table_info(users);", [], (err, columns) => {
    if (err) {
      console.error("Ошибка при получении информации о таблице:", err.message);
    } else {
      const columnExists = columns.some((col) => col.name === "code");
      if (!columnExists) {
        db.run("ALTER TABLE users ADD COLUMN code TEXT;", (alterErr) => {
          if (alterErr) {
            console.error(
              "Ошибка при добавлении колонки code:",
              alterErr.message
            );
          } else {
            console.log("Колонка code успешно добавлена");
          }
        });
      }
    }
  });
});

function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9]{5,12}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  return password.length >= 5 && password.length <= 16;
}

app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!validateUsername(username)) {
    return res
      .status(400)
      .send(
        "Имя пользователя должно содержать от 5 до 12 символов и только буквы или цифры."
      );
  }

  if (!validatePassword(password)) {
    return res.status(400).send("Пароль должен содержать от 5 до 16 символов.");
  }

  db.get(
    "SELECT username FROM users WHERE username = ?",
    [username],
    (err, row) => {
      if (row) {
        return res
          .status(400)
          .send("Пользователь с таким именем уже существует.");
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const code = Math.random().toString(36).substr(2, 8); // Генерация случайного кода
      const balance = 0.0; // Начальный баланс

      db.run(
        "INSERT INTO users (username, password, code, balance) VALUES (?, ?, ?, ?)",
        [username, hashedPassword, code, balance],
        (err) => {
          if (err) {
            return res.status(500).send("Ошибка при регистрации.");
          }
          res.send("Регистрация прошла успешно!");
        }
      );
    }
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT password FROM users WHERE username = ?",
    [username],
    (err, row) => {
      if (err || !row) {
        return res
          .status(400)
          .send("Неправильное имя пользователя или пароль.");
      }

      if (bcrypt.compareSync(password, row.password)) {
        res.redirect(`/cabinet?username=${username}`);
      } else {
        res.status(400).send("Неправильное имя пользователя или пароль.");
      }
    }
  );
});

app.get("/cabinetData", (req, res) => {
  const username = req.query.username;
  console.log("Запрос на данные кабинета для пользователя:", username);

  db.get(
    "SELECT username, code, balance FROM users WHERE username = ?",
    [username],
    (err, row) => {
      if (err) {
        console.error("Ошибка при получении данных:", err.message);
        return res.status(500).send("Ошибка при получении данных.");
      }
      if (!row) {
        console.error("Ошибка при получении данных: пользователь не найден");
        return res.status(400).send("Пользователь не найден.");
      }
      res.json(row);
    }
  );
});

app.get("/users", (req, res) => {
  db.all("SELECT username, password FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).send("Ошибка при получении данных пользователей.");
    }
    res.json(rows);
  });
});

app.get("/cabinet", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cabinet.html"));
});

// Настроим маршрут для обслуживания Main.html как главной страницы
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Main.html"));
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
