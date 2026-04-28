# Render 배포 안내

## 1. GitHub에 업로드
이 폴더 전체를 GitHub 저장소에 올립니다. `node_modules`는 올리지 않습니다.

## 2. Render 설정
Render Dashboard → New → Web Service → GitHub 저장소 연결

설정값:

- Environment: Node
- Build Command: `npm install`
- Start Command: `npm start`

## 3. 관리자 비밀번호 환경변수 설정
Render의 Environment Variables에 아래 값을 추가하세요.

- `ADMIN_USER` : 관리자 아이디. 예: `admin`
- `ADMIN_PASSWORD` : 관리자 비밀번호. 반드시 직접 정한 비밀번호로 변경

환경변수를 설정하지 않으면 테스트용 기본값이 사용됩니다.

- 기본 아이디: `admin`
- 기본 비밀번호: `admin1234!`

실제 운영에서는 기본 비밀번호를 절대 그대로 쓰지 마세요.

## 4. 접속 주소
배포 후 Render에서 제공하는 주소로 접속합니다.

- 홈페이지: `https://프로젝트이름.onrender.com`
- 관리자 페이지: `https://프로젝트이름.onrender.com/admin`
- 서버 상태 확인: `https://프로젝트이름.onrender.com/health`

## 5. DB 주의사항
현재 예약 DB는 SQLite 파일로 저장됩니다. Render 무료 서버는 재시작/재배포 시 파일 데이터가 유지되지 않을 수 있습니다.

테스트용으로는 가능하지만, 실제 운영용은 Supabase/PostgreSQL 같은 외부 DB로 바꾸는 것을 권장합니다.
