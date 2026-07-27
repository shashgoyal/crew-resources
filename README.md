# Crew Resources & Flight Status Notification Platform

An intelligent, full-stack aviation roster management and flight status tracking platform built with **Next.js 14**, **React**, and **Supabase**.

This application allows airline flight crew members (pilots, cabin crew) to parse schedule PDFs, monitor duty schedules, track flight statuses, calculate landing counts, and receive automated crew notifications.

---

## 🚀 Key Features

- **Automated Roster PDF Parser**: Extracts flight numbers, dates, departure/arrival airports (STD/STA), aircraft types, and duty status directly from airline schedule PDFs (e.g., IndiGo Schedule Reports).
- **Flight & Duty Tracker**: Real-time status monitoring for upcoming flights, layovers, base duties, and deadhead flights.
- **Interactive Crew Dashboard**: Responsive schedule calendar, flight timeline, statistics (total landings, flying hours), and duty breakdowns.
- **Supabase Integration**: Cloud database persistence for profile management, flight history, and roster storage.
- **Notification Ready**: Built to support automated alerts and updates via WhatsApp/SMS for crew schedule updates and flight delays.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI & Components**: React 18, Tailwind / Custom Glassmorphic CSS, Lucide React Icons
- **Backend & Database**: Supabase (PostgreSQL), Supabase JS Client
- **PDF Parsing**: PDF.js (`pdfjs-dist`)
- **Language**: JavaScript (ES Modules)

---

## 📋 Prerequisites

Before running the project locally, ensure you have:

- [Node.js](https://nodejs.org/) (v18.x or later recommended)
- `npm` or `yarn` package manager
- A [Supabase](https://supabase.com/) project instance

---

## ⚙️ Environment Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/shashgoyal/crew-resources.git
   cd crew-resources
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

4. **Fill in your Supabase Credentials in `.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
   SUPABASE_SECRET_KEY=your-supabase-service-role-key
   SUPABASE_JWKS_URL=https://your-supabase-project.supabase.co/auth/v1/.well-known/jwks.json
   ```

> 🔒 **Security Note**: Never commit `.env.local` or expose your Supabase secret keys in git repositories. `.env.local` is listed in `.gitignore`.

---

## 🗄️ Database Setup & Seeding

1. **Verify Connection**:
   Check connection to your Supabase instance:
   ```bash
   node scripts/apply-schema.mjs
   ```

2. **Seed Roster PDF Data**:
   Parse and populate flight schedules into Supabase from a schedule PDF:
   ```bash
   node scripts/seed-supabase.mjs path/to/ScheduleReport.pdf
   ```

---

## 🏃 Running the Application

### Development Mode

Start the Next.js local development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Production Build

Build and start the application for production:
```bash
npm run build
npm run start
```

---

## 📂 Project Structure

```text
├── app/
│   ├── api/             # Next.js API route handlers
│   ├── components/      # React UI components (LandingPage, FlightCards, etc.)
│   ├── globals.css      # Styling tokens and global CSS
│   ├── layout.js        # Root application layout
│   └── page.js          # Dashboard homepage
├── lib/
│   ├── parser/          # Schedule PDF extraction logic
│   ├── supabase/        # Supabase client and server initializers
│   └── store.js         # Client-side state management & helpers
├── scripts/
│   ├── apply-schema.mjs # Database schema verification script
│   └── seed-supabase.mjs# Roster PDF parsing and database seeder
├── .env.example         # Environment template (No real keys)
├── .gitignore           # Git ignore file for secrets and dependencies
└── package.json         # Project dependencies and scripts
```

---

## 🔐 Security Guidelines

- Ensure `.env.local` is never staged or committed.
- Keep Supabase service role keys private on server/admin environments.
- Use `NEXT_PUBLIC_` prefixed keys only for client-safe public values.

---

## 📄 License

This project is licensed under the MIT License.
