const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// Render 배포 시에는 환경변수로 반드시 변경하세요.
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234!";

// 무료 Render에서는 파일 저장소가 재시작/재배포 시 초기화될 수 있습니다.
// 테스트용은 기본값으로 충분하고, 운영용은 Render Disk 또는 외부 DB 사용을 권장합니다.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "reservations.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// 기본 보안 헤더
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

function adminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {090807
      return next();
    }
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Reservation Admin"');
  return res.status(401).send(`
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>관리자 인증 필요</title>
        <style>
          body { font-family: Arial, sans-serif; background:#f5f7fa; color:#111; padding:40px; line-height:1.7; }
          .box { max-width:520px; margin:80px auto; background:white; border-radius:22px; padding:34px; box-shadow:0 14px 38px rgba(0,0,0,.08); }
          a { color:#2563eb; font-weight:700; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>관리자 인증이 필요합니다</h1>
          <p>예약 DB 확인 페이지는 관리자 계정으로만 접근할 수 있습니다.</p>
          <p><a href="/">홈페이지로 이동</a></p>
        </div>
      </body>
    </html>
  `);
}

app.use(express.static(PUBLIC_DIR));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("DB 연결 오류:", err.message);
  } else {
    console.log("DB 연결 완료:", DB_PATH);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      car TEXT,
      service_type TEXT,
      preferred_date TEXT,
      memo TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
});

app.get(["/", "/index"], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get(["/admin", "/admin/"], adminAuth, (req, res) => {
  const adminPath = path.join(PUBLIC_DIR, "admin.html");
  if (!fs.existsSync(adminPath)) {
    return res.status(404).send("admin.html 파일을 찾을 수 없습니다. public 폴더를 확인하세요.");
  }
  res.sendFile(adminPath);
});

app.post("/api/reservations", (req, res) => {
  const { name, phone, car, serviceType, preferredDate, memo } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ ok: false, message: "이름과 연락처는 필수입니다." });
  }

  const sql = `
    INSERT INTO reservations (name, phone, car, service_type, preferred_date, memo)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      String(name).trim(),
      String(phone).trim(),
      String(car || "").trim(),
      String(serviceType || "").trim(),
      String(preferredDate || "").trim(),
      String(memo || "").trim()
    ],
    function (err) {
      if (err) {
        console.error("예약 저장 오류:", err.message);
        return res.status(500).json({ ok: false, message: "DB 저장 중 오류가 발생했습니다." });
      }
      res.json({ ok: true, id: this.lastID });
    }
  );
});

// 개인정보가 포함되므로 조회 API는 관리자 인증 적용
app.get("/api/reservations", adminAuth, (req, res) => {
  db.all("SELECT * FROM reservations ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      console.error("예약 조회 오류:", err.message);
      return res.status(500).json({ ok: false, message: "예약 목록 조회 중 오류가 발생했습니다." });
    }
    res.json({ ok: true, reservations: rows });
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "tinting-shop", time: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).send(`
    <h1>페이지를 찾을 수 없습니다.</h1>
    <p><a href="/">홈페이지</a></p>
    <p><a href="/admin">관리자 페이지</a></p>
  `);
});

process.on("SIGINT", () => {
  db.close(() => process.exit(0));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`홈페이지: http://localhost:${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin`);
  console.log(`예약 API: http://localhost:${PORT}/api/reservations`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("주의: ADMIN_PASSWORD 환경변수가 없습니다. 기본 비밀번호(admin1234!)가 사용됩니다. Render 배포 시 반드시 변경하세요.");
  }
});
