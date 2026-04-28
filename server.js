const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("SUPABASE_URL 환경변수가 없습니다.");
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

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

// 관리자 인증
function requireAdmin(req, res, next) {
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin1234!";

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Reservation Admin"');
    return res.status(401).send("관리자 로그인이 필요합니다.");
  }

  const encoded = authHeader.split(" ")[1];
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const separatorIndex = decoded.indexOf(":");

  const inputUser = decoded.slice(0, separatorIndex);
  const inputPassword = decoded.slice(separatorIndex + 1);

  if (inputUser === adminUser && inputPassword === adminPassword) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Reservation Admin"');
  return res.status(401).send("아이디 또는 비밀번호가 올바르지 않습니다.");
}

// 관리자 페이지 보호
app.get(["/admin", "/admin/"], requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

// admin.html 직접 접근도 보호
app.get("/admin.html", requireAdmin, (req, res) => {
  res.redirect("/admin");
});

// 정적 파일 제공
app.use(express.static(PUBLIC_DIR));

// 메인 페이지
app.get(["/", "/index"], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// 예약 저장 API
app.post("/api/reservations", async (req, res) => {
  try {
    const { name, phone, car, serviceType, preferredDate, memo } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        ok: false,
        message: "이름과 연락처는 필수입니다."
      });
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert([
        {
          name,
          phone,
          car,
          service_type: serviceType,
          preferred_date: preferredDate,
          memo
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      ok: true,
      message: "예약이 저장되었습니다.",
      reservation: data
    });
  } catch (error) {
    console.error("예약 저장 오류:", error);
    return res.status(500).json({
      ok: false,
      message: "예약 저장 중 오류가 발생했습니다."
    });
  }
});

// 예약 조회 API - 관리자 인증 필요
app.get("/api/reservations", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, name, phone, car, service_type, preferred_date, memo, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const reservations = data.map((item) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      car: item.car,
      serviceType: item.service_type,
      preferredDate: item.preferred_date,
      memo: item.memo,
      createdAt: item.created_at
    }));

    res.json({
      ok: true,
      reservations
    });
  } catch (error) {
    console.error("예약 조회 오류:", error);
    res.status(500).json({
      ok: false,
      message: "예약 조회 중 오류가 발생했습니다."
    });
  }
});
// 상태 확인
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "tinting-shop",
    db: "supabase",
    time: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).send(`
    <h1>페이지를 찾을 수 없습니다.</h1>
    <p><a href="/">홈페이지</a></p>
    <p><a href="/admin">관리자 페이지</a></p>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`홈페이지: http://localhost:${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin`);
  console.log(`예약 API: http://localhost:${PORT}/api/reservations`);
  console.log(`상태 확인: http://localhost:${PORT}/health`);

  if (!process.env.ADMIN_PASSWORD) {
    console.warn("주의: ADMIN_PASSWORD 환경변수가 없습니다. 기본 비밀번호(admin1234!)가 사용됩니다.");
  }
});
