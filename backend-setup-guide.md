# Prepskm Production Backend Schema & Storage Rules

This document outlines the database schema, storage bucket configuration, and security rules for **Prepskm** (JEE & NEET Exam Prep & Mentorship Platform).

---

## 1. Firebase Firestore Schema & Security Rules

### Collections Architecture

1. **`study_materials`** (or `materials`):
   - `id`: string (e.g. `pdf-179371234`)
   - `title`: string (e.g. `Rotational Motion Class Handwritten Notes`)
   - `subject`: string (`Physics` | `Chemistry` | `Mathematics` | `Biology`)
   - `chapter`: string (e.g. `Rotational Dynamics`)
   - `sectionId`: string (`sec-notes` | `sec-pyqs` | `sec-formulas` | `sec-mindmaps`)
   - `sectionName`: string
   - `exam`: string (`JEE` | `NEET` | `ALL`)
   - `pdf_url` / `downloadUrl`: string (Cloud Storage URL or Base64 DataURI)
   - `fileName`: string
   - `createdAt`: ISO 8601 string

2. **`mock_tests`**:
   - `id`: string (e.g. `test-all-india-jee-4`)
   - `title`: string (e.g. `JEE Main 2027 All India CBT Mock Test Series #4`)
   - `syllabus`: string
   - `duration_minutes`: number (e.g. 180)
   - `total_questions`: number (e.g. 75)
   - `total_marks`: number (e.g. 300)
   - `is_live`: boolean
   - `questions`: array of objects:
     - `id`: string
     - `question_text`: string
     - `question_image_url`: string | null
     - `options`: array of 4 strings `[A, B, C, D]`
     - `correct_option`: string (`A`, `B`, `C`, or `D`)
     - `question_type`: string (`MCQ` or `NAT`)
     - `solution_explanation`: string

3. **`video_lectures`** (or `videos`):
   - `id`: string (e.g. `v-179372`)
   - `title`: string
   - `subject`: string
   - `chapter`: string
   - `video_url`: string (YouTube embed, unlisted URL, or direct MP4 link)
   - `mentorName`: string
   - `companionPdfs`: array of `{ title, url }`
   - `created_at`: ISO 8601 string

4. **`subjects_and_chapters`** (doc: `curriculum/hierarchy`):
   - `subjects`: array of strings `['Physics', 'Chemistry', 'Mathematics', 'Biology']`
   - `chapters`: object mapping subject to array of chapter names

5. **`formula_blitz_scores`**:
   - `id`: string
   - `playerName`: string
   - `playerAvatar`: string
   - `subject`: string
   - `score`: number
   - `accuracy`: number
   - `streakMax`: number
   - `speedAvg`: number
   - `weakTopic`: string
   - `timestamp`: ISO 8601 string

6. **`directInquiries`**:
   - `id`: string
   - `senderId`: string
   - `senderName`: string
   - `senderAvatar`: string
   - `senderEmail`: string
   - `studentUid`: string
   - `text`: string
   - `imageUrl`: string | null
   - `isOwner`: boolean
   - `timestamp`: ISO 8601 string

---

### Firestore Production Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if request is from authorized Academic Directorate
    function isAdmin() {
      return request.auth != null && (
        request.auth.token.email.matches(".*(sumitiitair01|saurav586kumar|unfiltereddsumit)@gmail\\.com") ||
        request.auth.token.role == 'admin' ||
        request.auth.token.role == 'superadmin'
      );
    }

    // Public read-only for students, Admin-only write
    match /study_materials/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /materials/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /mock_tests/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /video_lectures/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /videos/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /curriculum/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /sections/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Interactive student features (Anyone can submit scores / chat / inquiries)
    match /formula_blitz_scores/{id} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if isAdmin();
    }
    match /communityChat/{id} {
      allow read, create: if true;
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likes']);
      allow delete: if isAdmin();
    }
    match /directInquiries/{id} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }
    match /activeCalls/{id} {
      allow read, write: if true;
    }
  }
}
```

---

## 2. Supabase SQL Schema (PostgreSQL Alternative)

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Study Materials table
create table public.study_materials (
  id text primary key,
  title text not null,
  subject text not null,
  chapter text not null,
  section_name text not null,
  exam text not null default 'JEE',
  pdf_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Video Lectures table
create table public.video_lectures (
  id text primary key,
  title text not null,
  subject text not null,
  chapter text not null,
  video_url text not null,
  mentor_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Mock Tests table
create table public.mock_tests (
  id text primary key,
  title text not null,
  syllabus text not null,
  duration_minutes integer not null default 180,
  total_questions integer not null default 75,
  is_live boolean not null default true,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Formula Blitz Leaderboard table
create table public.formula_blitz_scores (
  id uuid default uuid_generate_v4() primary key,
  player_name text not null,
  player_avatar text,
  subject text not null,
  score integer not null,
  accuracy numeric(5,2) not null,
  streak_max integer not null,
  speed_avg numeric(5,2) not null,
  weak_topic text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```
