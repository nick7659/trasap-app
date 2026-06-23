========================================
คำสั่งที่ต้องรันหลังจากวางไฟล์ครบแล้ว
========================================

1. ติดตั้ง package ที่จำเป็น (รันครั้งเดียว)
   cd trasap-app
   npm install react-router-dom

2. แก้ไขไฟล์ src/supabase.js ใส่ค่าของตัวเอง:
   - VITE_SUPABASE_URL  → Project URL จาก Supabase Dashboard
   - VITE_SUPABASE_ANON_KEY → anon key จาก Supabase Dashboard

3. สร้างไฟล์ .env ใน root ของโปรเจกต์:
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...

4. รันโปรเจกต์
   npm run dev

5. เปิด browser ไปที่ http://localhost:5173

========================================
โครงสร้างไฟล์ที่ต้องมี
========================================

trasap-app/
├── .env                          ← สร้างใหม่ (ใส่ key ของตัวเอง)
├── src/
│   ├── main.jsx                  ← แทนที่ไฟล์เดิม
│   ├── App.jsx                   ← แทนที่ไฟล์เดิม
│   ├── index.css                 ← แทนที่ไฟล์เดิม
│   ├── supabase.js               ← ที่สร้างไว้แล้วในขั้น 5.3 (แก้ key)
│   ├── pages/
│   │   ├── Login.jsx             ← ไฟล์ใหม่
│   │   ├── Dashboard.jsx         ← ไฟล์ใหม่
│   │   ├── CreateDoc.jsx         ← ไฟล์ใหม่
│   │   └── AckPage.jsx           ← ไฟล์ใหม่
│   └── components/
│       ├── SignatureCanvas.jsx   ← ไฟล์ใหม่
│       └── DocCard.jsx           ← ไฟล์ใหม่
