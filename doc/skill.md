# RunAI Project Skill

> เอกสารนี้เป็นกติกากลางสำหรับการพัฒนาโปรเจกต์ RunAI
> ทุกครั้งที่มีการออกแบบระบบ เขียนโค้ด แก้ไข Database, ER Diagram,
> Requirement, UI หรือ Workflow ให้ยึดกฎในไฟล์นี้เป็นหลัก
>
> หากมีความต้องการใหม่ที่ขัดแย้งกับกฎในไฟล์นี้
> ห้ามเปลี่ยนกฎเดิมโดยอัตโนมัติ ต้องแจ้งความขัดแย้งและขอการยืนยันก่อน

---

# 1. Project Overview

## Project Name

**RunAI: วางแผนการวิ่งด้วย AI**

## Project Type

Web Application

## Project Purpose

RunAI เป็นระบบที่ช่วยผู้ใช้งานวางแผนและติดตามการฝึกวิ่งโดยใช้ AI
ระบบนำข้อมูลพื้นฐานของผู้ใช้งาน เป้าหมายการวิ่ง และประวัติการวิ่ง
มาใช้ประกอบการวิเคราะห์และสร้างตารางการฝึก

จุดเด่นของระบบคือ ตารางการฝึกจะถูกแบ่งออกเป็น Quest รายวัน
และ AI สามารถนำผลของ Quest ที่ผู้ใช้งานทำไม่สำเร็จมาใช้วิเคราะห์
และปรับ Quest ที่ยังไม่เกิดในตาราง

---

# 2. Core Concept

แนวคิดหลักของ RunAI คือ:

```text
User
  ↓
ข้อมูลพื้นฐาน
  ↓
ประวัติการวิ่งอย่างน้อย 1 ครั้ง
  ↓
Goal
  ↓
AI วิเคราะห์
  ↓
AI สร้าง Training Plan
  ↓
Training Plan แตกเป็น Quest รายวัน
  ↓
ผู้ใช้ทำ Quest
  ↓
ส่งผล Quest
  ├── สำเร็จ
  │     ↓
  │   ใช้ตารางเดิม
  │     ↓
  │   ปลดล็อก Quest วันถัดไป
  │
  └── ไม่สำเร็จ
        ↓
      ระบุเหตุผล
        ↓
      AI วิเคราะห์
        ↓
      ปรับ Quest ที่ยังไม่เกิด
        ↓
      ผู้ใช้ยอมรับแผนใหม่
        ↓
      ใช้ตารางใหม่
```

RunAI ไม่ได้เป็นเพียงระบบสร้างตารางวิ่ง
แต่เป็นระบบที่นำผลจากการทำ Quest กลับมาใช้ในการปรับตาราง

---

# 3. Target User

ระบบมีผู้ใช้งานหลักคือ:

- นักวิ่ง / ผู้ใช้งานที่ต้องการพัฒนาความสามารถในการวิ่ง
- ผู้ที่มีเป้าหมายในการวิ่ง

---

# 4. Core Business Rules

## BR-01: Authentication

ผู้ใช้งานต้องสมัครสมาชิกและเข้าสู่ระบบก่อนใช้งานฟังก์ชันหลักของระบบ

## BR-02: Minimum Running History

ผู้ใช้งานต้องมีประวัติการวิ่งอย่างน้อย **1 รายการ**
ก่อนจึงจะสามารถให้ AI สร้างตารางการฝึกครั้งแรกได้

## BR-03: One Active Training Plan

ผู้ใช้งาน 1 คนสามารถมี **ตารางการฝึกที่กำลังใช้งานอยู่ (Active Plan)**
ได้เพียง **1 ตารางในเวลาเดียวกัน**

## BR-04: Daily Quest

Training Plan ประกอบด้วย Quest รายวัน

แต่ละวันมีได้:

```text
0 หรือ 1 Quest
```

หากวันนั้นไม่มี Quest:

```text
วันนี้ไม่มีเควส
```

ผู้ใช้งานไม่ต้องส่งผลใด ๆ ในวันนั้น

## BR-05: Quest Time

Quest ของวันปัจจุบัน:

```text
เริ่ม: 00:00
หมดเวลา: 23:59
```

Quest ของวันถัดไปจะยังไม่ปลดล็อก
จนกว่า Quest ของวันปัจจุบันจะมีผลลัพธ์ตาม Workflow

## BR-06: Quest Submission

ผู้ใช้งานส่ง Quest ได้ **เพียงครั้งเดียว**

หลังส่งแล้ว:

```text
ไม่สามารถแก้ไขผลการส่งได้
```

## BR-07: Running Data Required for Quest Submission

การส่ง Quest ต้องมีข้อมูลการวิ่งอย่างน้อย:

- ระยะทางจริง
- เวลาที่ใช้จริง

## BR-08: Quest Success Rule

ระบบใช้ **ระยะทางจริง** เป็นเกณฑ์หลักในการตัดสินว่า Quest สำเร็จหรือไม่

ตัวอย่าง:

```text
Quest = 5 km

วิ่ง 5.0 km → สำเร็จ
วิ่ง 5.2 km → สำเร็จ
วิ่ง 4.9 km → ไม่สำเร็จ
```

เวลาใช้เป็นข้อมูลประกอบและเก็บไว้ในประวัติ
แต่ไม่ได้เป็นเกณฑ์หลักในการตัดสินสถานะสำเร็จของ Quest

## BR-09: Quest Not Passed

หากระยะทางจริงน้อยกว่าระยะทางเป้าหมาย:

ระบบต้องไม่อนุญาตให้ผู้ใช้งานส่ง Quest เป็นสถานะสำเร็จ

ระบบต้องแจ้ง:

```text
เควสยังไม่ผ่าน
```

จากนั้นผู้ใช้งานสามารถเลือก:

```text
ทำเควสไม่สำเร็จ
```

และต้องระบุเหตุผล

## BR-10: Quest Failed

เมื่อผู้ใช้งานเลือก:

```text
ทำเควสไม่สำเร็จ
```

ระบบต้องเก็บ:

- สถานะไม่สำเร็จ
- เหตุผล
- ข้อมูลผลการวิ่งที่มี ถ้ามี
- วันและเวลาที่ส่ง

## BR-11: Quest Timeout

หากผู้ใช้งานไม่ส่ง Quest ภายในเวลา 23:59:

```text
Quest = ไม่สำเร็จจากการหมดเวลา
```

กรณีนี้ไม่ต้องให้ผู้ใช้งานระบุเหตุผล

ระบบสามารถใช้สถานะ:

```text
expired
```

เพื่อแยกจากกรณีที่ผู้ใช้งานกดไม่สำเร็จด้วยตนเองได้

## BR-12: Successful Quest

หาก Quest สำเร็จ:

```text
ไม่ต้องปรับตารางด้วย AI
```

ระบบใช้ตารางเดิมต่อ

และปลดล็อก Quest ของวันถัดไปตามตารางเดิม

## BR-13: Failed Quest

หาก Quest ไม่สำเร็จ:

```text
ส่งข้อมูลผล Quest
+
เหตุผล (ถ้ามี)
↓
AI วิเคราะห์ทันที
```

AI ต้องพิจารณา Quest ที่ไม่สำเร็จ
ร่วมกับตารางการฝึกที่เหลือ

## BR-14: AI Plan Adjustment

เมื่อ Quest ไม่สำเร็จ:

AI สามารถปรับ:

```text
เฉพาะ Quest ที่ยังไม่เกิด
```

Quest ของวันที่ผ่านมาแล้ว:

```text
ห้ามแก้ไข
```

ผลการส่ง Quest ที่ถูกล็อกแล้ว:

```text
ห้ามแก้ไข
```

## BR-15: Accept New Plan

เมื่อ AI ปรับตาราง:

ระบบต้องแสดงตารางใหม่ให้ผู้ใช้งานดู

ผู้ใช้งานต้องกด:

```text
ยอมรับแผน
```

ก่อนจึงจะใช้ตารางใหม่

ใน Version ปัจจุบัน:

```text
ผู้ใช้งานไม่สามารถแก้รายละเอียด Quest เอง
```

## BR-16: Goal Completed Early

หากผู้ใช้งานบรรลุ Goal ก่อนวันสิ้นสุด:

ระบบต้องให้ผู้ใช้งานเลือก:

```text
วิ่งตามตารางต่อ
จบเป้าหมายนี้
```

### หากเลือก "วิ่งตามตารางต่อ"

- ใช้ตารางเดิมต่อ
- ไม่ปรับตารางอัตโนมัติเพียงเพราะ Goal สำเร็จ

### หากเลือก "จบเป้าหมายนี้"

- Goal เปลี่ยนเป็น Completed
- ตารางของ Goal นั้นสิ้นสุด
- ผู้ใช้งานสามารถสร้าง Goal ใหม่ได้

---

# 5. Quest Concept

ในระบบ RunAI:

```text
Training_Session = Quest
```

ไม่สร้าง Entity `Quest` แยก

ตัวอย่าง:

```text
Training Plan
│
├── Monday
│    └── Easy Run 5 km
│
├── Tuesday
│    └── ไม่มีเควส
│
└── Wednesday
     └── Interval 4 km
```

---

# 6. Quest Status

สถานะที่ระบบรองรับ:

```text
locked
available
completed
failed
expired
```

ความหมาย:

### locked
Quest ยังไม่ปลดล็อก

### available
Quest ของวันปัจจุบันที่สามารถทำได้

### completed
ผู้ใช้งานส่งผลและระยะทางถึงเป้าหมาย

### failed
ผู้ใช้งานเลือกว่าทำ Quest ไม่สำเร็จ

### expired
ผู้ใช้งานไม่ส่ง Quest ภายใน 23:59

---

# 7. Quest Workflow

## Successful Quest

```text
Quest Available
      ↓
ผู้ใช้วิ่ง
      ↓
Submit Quest
      ↓
ตรวจ Distance
      ↓
Distance >= Target
      ↓
Completed
      ↓
Unlock Next Quest
```

## Failed Quest

```text
Quest Available
      ↓
ผู้ใช้วิ่ง
      ↓
Submit Quest
      ↓
Distance < Target
      ↓
"เควสยังไม่ผ่าน"
      ↓
ผู้ใช้เลือก "ทำเควสไม่สำเร็จ"
      ↓
ระบุเหตุผล
      ↓
Failed
      ↓
AI Analysis
      ↓
ปรับ Quest ที่ยังไม่เกิด
      ↓
แสดงตารางใหม่
      ↓
ยอมรับแผน
      ↓
ใช้ตารางใหม่
```

## Timeout Quest

```text
Quest Available
      ↓
ไม่มีการส่งผล
      ↓
23:59
      ↓
Expired
      ↓
ถือว่าไม่สำเร็จ
      ↓
AI Analysis
      ↓
ปรับ Quest ที่ยังไม่เกิด
```

---

# 8. Running Data Rules

ข้อมูลการวิ่งหลัก:

- วันที่
- ระยะทาง
- เวลา
- ประเภทการวิ่ง

ระบบ **ไม่เก็บ Pace**

Pace สามารถคำนวณภายหลังจาก:

```text
เวลา ÷ ระยะทาง
```

ระบบ **ไม่เก็บความรู้สึกหลังวิ่ง**

---

# 9. Strava Rules

ปัจจุบันระบบ:

- ไม่เชื่อมต่อ Strava API
- ไม่ดึงข้อมูล Strava อัตโนมัติ
- ผู้ใช้สามารถแนบรูปจาก Strava ได้
- การแนบรูปไม่บังคับ
- ระบบไม่อ่านข้อความจากรูป
- ระบบไม่วิเคราะห์ข้อมูลจากรูป

Strava API เป็น:

```text
Future Feature
```

---

# 10. AI Rules

AI ของ RunAI ใช้ข้อมูลประกอบการวิเคราะห์ เช่น:

### User Information
- อายุ
- น้ำหนัก
- ส่วนสูง
- ระดับประสบการณ์

### Goal Information
- เป้าหมาย
- ระยะทางเป้าหมาย
- เวลาเป้าหมาย
- วันที่ต้องการบรรลุเป้าหมาย

### Running History
- ระยะทาง
- เวลา
- ประเภทการวิ่ง
- ประวัติการวิ่งย้อนหลัง

### Quest Result
- สถานะ Quest
- ระยะทางจริง
- เวลาจริง
- เหตุผลที่ไม่สำเร็จ (ถ้ามี)

AI สามารถทำหน้าที่:

```text
วิเคราะห์ข้อมูล
สร้างตาราง
สร้าง Quest
วิเคราะห์ Quest ที่ไม่สำเร็จ
ปรับ Quest ที่ยังไม่เกิด
สร้างคำแนะนำ
```

AI ไม่ได้ทำหน้าที่วินิจฉัยหรือรักษาทางการแพทย์

---

# 11. Database Entities

Entity หลักของระบบ:

```text
Users
Goals
Runs
Training_Plans
Training_Sessions
Training_Progress
AI_Analysis
Plan_Adjustments
```

หน้าที่ของแต่ละ Entity:

### Users
เก็บข้อมูลผู้ใช้งาน

### Goals
เก็บเป้าหมายการวิ่ง

### Runs
เก็บข้อมูลการวิ่งจริง

### Training_Plans
เก็บตารางการฝึก

### Training_Sessions
เก็บ Quest รายวัน

### Training_Progress
เก็บผลการส่ง Quest

### AI_Analysis
เก็บผลการวิเคราะห์จาก AI

### Plan_Adjustments
เก็บประวัติการปรับตาราง

---

# 12. ER Relationship Rules

ความสัมพันธ์หลัก:

```text
Users 1 : N Goals

Users 1 : N Runs

Users 1 : N Training_Plans

Users 1 : N AI_Analysis

Goals 1 : N Training_Plans

Training_Plans 1 : N Training_Sessions

Training_Sessions 1 : 0..1 Training_Progress

Training_Progress 1 : 0..1 Runs

Training_Plans 1 : N AI_Analysis

Training_Plans 1 : N Plan_Adjustments

AI_Analysis 1 : N Plan_Adjustments
```

หมายเหตุ:

`Training_Progress → Runs` เป็น Optional

เพราะบางกรณี เช่น Quest หมดเวลา
อาจไม่มี Run จริง

---

# 13. Database Naming Rules

ใช้ชื่อแบบ:

```text
snake_case
```

ตัวอย่าง:

```text
user_id
experience_level
run_time
target_distance
created_at
updated_at
```

ชื่อ Table ใช้:

```text
profiles
goals
runs
training_plans
training_sessions
training_progress
ai_analysis
plan_adjustments
```

---

# 14. Security Rules

## Password

ใช้ Supabase Auth จัดการ Register, Login, Session และ Password

ห้ามเก็บรหัสผ่านหรือ password hash เองใน public application tables เช่น:

```text
profiles
goals
runs
training_plans
```

## User Data

ผู้ใช้งานต้องสามารถเข้าถึงเฉพาะข้อมูลของตนเอง

ห้ามเปิดเผย:

- ข้อมูลบัญชี
- ข้อมูลส่วนตัว
- ประวัติการวิ่ง
- Goal
- Training Plan
- Quest
- AI Analysis

ของผู้ใช้งานรายอื่น

---

# 15. Current Scope

ระบบปัจจุบันรองรับ:

- Account
- User Profile
- Goal
- Running History
- Running Progress
- AI Analysis
- AI Training Plan
- Daily Quest
- Quest Submission
- Quest Success / Failed / Expired
- AI Plan Adjustment
- Accept New Plan
- Goal Completion
- Optional Strava Image Attachment

---

# 16. Out of Scope

ยังไม่ทำ:

- GPS Tracking แบบ Real-time
- Strava API Integration
- Automatic Strava Data Import
- Social Features
- Equipment Marketplace
- Medical Diagnosis
- Automatic reading of Strava screenshots

---

# 17. Development Principles

## Principle 1: Follow Requirements

การพัฒนาต้องอ้างอิง:

```text
Proposal
↓
Requirements
↓
Business Rules
↓
ER / Database
↓
Implementation
```

ห้ามสร้าง Feature ที่ไม่มี Requirement โดยไม่มีเหตุผล

## Principle 2: Do Not Break Existing Business Rules

ห้ามเปลี่ยน Logic ต่อไปนี้โดยอัตโนมัติ:

- 1 User มี Active Plan ได้ 1 ตาราง
- 1 วันมี 0 หรือ 1 Quest
- Quest เปิด 00:00
- Quest หมด 23:59
- ส่ง Quest แล้วแก้ไม่ได้
- ระยะทางเป็นเกณฑ์หลัก
- สำเร็จ → ใช้ตารางเดิม
- ไม่สำเร็จ → AI ปรับ Quest ที่ยังไม่เกิด
- ต้องยอมรับตารางใหม่
- ผู้ใช้แก้ Quest เองไม่ได้

ถ้าต้องการเปลี่ยน ต้องขอการยืนยันก่อน

## Principle 3: Keep Data Consistent

ER Diagram, SQL, Backend และ Requirements
ต้องใช้ชื่อและความหมายของข้อมูลสอดคล้องกัน

ตัวอย่าง:

```text
ER
profiles.user_id
    ↓
SQL
profiles.user_id
    ↓
Backend
profiles.user_id
```

ไม่ควรใช้ชื่อคนละแบบโดยไม่มีเหตุผล

## Principle 4: Avoid Unnecessary Complexity

หาก Requirement ยังไม่ต้องการ:

```text
อย่าเพิ่ม Entity
อย่าเพิ่ม Table
อย่าเพิ่ม API
อย่าเพิ่ม Feature
```

โดยไม่มีเหตุผลที่ชัดเจน

---

# 18. Coding Rules

- ใช้โครงสร้างโค้ดที่อ่านง่าย
- แยก Frontend, Backend และ Database ให้ชัดเจน
- ไม่ hard-code ข้อมูลสำคัญ
- ตรวจสอบ Input ก่อนบันทึก
- ตรวจสอบสิทธิ์ผู้ใช้ก่อนเข้าถึงข้อมูล
- ใช้ Environment Variables สำหรับ Secret
- ไม่เก็บ API Key ใน Source Code
- เขียน Error Handling สำหรับ API และ Database
- ใช้ชื่อ Variable และ Function ที่สื่อความหมาย
- หลีกเลี่ยงโค้ดซ้ำโดยไม่จำเป็น

---

# 19. Change Management

เมื่อมี Requirement ใหม่:

```text
New Requirement
      ↓
ตรวจว่าเข้ากับ Core Concept หรือไม่
      ↓
ตรวจผลกระทบต่อ
- Proposal
- Requirements
- ER
- Database
- UI
- Backlog
      ↓
ถ้าขัดกับกฎเดิม
      ↓
ต้องยืนยันก่อนเปลี่ยน
```

ห้ามแก้ Database หรือ ER เพียงอย่างเดียว
โดยไม่ตรวจ Requirement ที่เกี่ยวข้อง

---

# 20. Definition of Done

งานหนึ่งรายการถือว่า Done เมื่อ:

- Requirement ตรงกับงาน
- Business Rule ถูกนำไปใช้
- Database ถูกต้อง
- Backend ทำงานได้
- Frontend ทำงานได้
- Validation ครบ
- Error Handling ครบ
- ทดสอบกรณีปกติแล้ว
- ทดสอบกรณีผิดพลาดแล้ว
- ไม่ทำให้ Feature เดิมพัง
- Code ผ่านการ Review
- งานถูกอัปเดตใน Jira

---

# 21. Working Instruction for AI Assistant

ก่อนแก้ไขหรือสร้างสิ่งใดในโปรเจกต์ RunAI:

1. อ่าน `skill.md`
2. ตรวจ Proposal / Requirements ที่เกี่ยวข้อง
3. ตรวจ Business Rules
4. ตรวจ ER / Database หากเป็นงานด้านข้อมูล
5. ตรวจ Backlog หากเป็นงาน Development
6. ระบุ Dependency ที่เกี่ยวข้อง
7. ห้ามสมมติ Requirement ที่ยังไม่ได้ตัดสินใจ
8. หากพบความขัดแย้ง ต้องแจ้งก่อนเปลี่ยน
9. หลังแก้ไข ต้องตรวจว่าเอกสาร/โค้ดส่วนอื่นยังสอดคล้องกัน

---

# 22. Priority of Sources

หากข้อมูลจากหลายแหล่งไม่ตรงกัน
ให้ตรวจตามลำดับ:

```text
1. Latest confirmed Business Rules
2. Latest confirmed Requirements
3. Latest confirmed ER / Database
4. Latest Proposal
5. Backlog
6. Previous implementation
```

หากยังหาข้อสรุปไม่ได้:

```text
หยุดการเปลี่ยนแปลง
และขอการยืนยันจากทีม
```

---

# 23. Important Reminders

RunAI ไม่ใช่:

```text
ระบบบันทึกการวิ่งธรรมดา
```

แต่เป็น:

```text
AI Training Planner
+
Daily Quest System
+
Feedback Loop
```

Core Feedback Loop:

```text
AI Plan
   ↓
Daily Quest
   ↓
User Runs
   ↓
Submit Result
   ↓
Success / Failed / Expired
   ↓
AI Analysis
   ↓
Adjust Future Quests
   ↓
New Plan
   ↓
Continue Training
```

นี่คือ Concept หลักที่ต้องรักษาไว้ตลอดการพัฒนา RunAI
