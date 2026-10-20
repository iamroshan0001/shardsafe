# ShardSafe: Secure Cloud File Vault with Block-Level Encryption, AWS Storage and CDN Hosting

**Final Year Cloud Computing Project — BE Artificial Intelligence and Data Science**  
**Target AWS Region:** `ap-south-1` (Mumbai)

---

## 1. Project Overview & Architecture

ShardSafe is a zero-knowledge cloud file vault engineered to demonstrate modern cloud security, block-level cryptography, and distributed AWS architectures.

### Core Workflow:
1. **File Slicing:** Binary files are divided into configurable 1 MiB blocks directly in the browser memory.
2. **Key Derivation:** A 256-bit AES key is derived locally via `PBKDF2-HMAC-SHA-256` (100,000 iterations) from a separate user-provided file-encryption passphrase and per-file cryptographic salt.
3. **AES-256-GCM Encryption:** Each block is independently encrypted with a unique 96-bit IV and 128-bit authentication tag. Plaintext and passphrases never touch the server.
4. **Direct S3 Streaming:** The browser requests temporary presigned upload URLs from the EC2 API and uploads ciphertext blocks directly to a private Amazon S3 bucket.
5. **Catalog Indexing in RDS:** Amazon RDS PostgreSQL indexes segment numbers, unique IVs, S3 object keys (`vault/{userId}/{fileId}/part-XXXXXX.bin`), and SHA-256 checksums.
6. **Authentication & Decryption:** When downloading, the browser downloads blocks from S3, authenticates the GCM tags using the derived key, and reassembles the original file. A wrong passphrase immediately fails authentication tag verification without leaking corrupted data.
7. **CloudFront CDN Documentation:** Technical documentation and architectural reports are distributed through Amazon CloudFront with Origin Access Control (OAC) from a private S3 bucket.

---

## 2. Repository Structure

```
shardsafe/
├── backend/                  # Node.js, Express, TypeScript API
│   ├── src/
│   │   ├── config/           # Environment and AWS configuration
│   │   ├── controllers/      # Route controllers
│   │   ├── db/               # PostgreSQL schema migrations and client
│   │   ├── middleware/       # Auth and rate limiting middleware
│   │   ├── routes/           # REST endpoints (auth, files, health, activity)
│   │   ├── services/         # S3 presigned URL service & auth service
│   │   └── index.ts          # Server entry point
│   ├── tests/                # Jest & Supertest integration tests
│   └── package.json
│
├── frontend/                 # React 19, TypeScript, Vite, Tailwind CSS
│   ├── src/
│   │   ├── api/              # API client and direct S3 fetchers
│   │   ├── components/       # BlockMatrix visualizer, Navbar, Modals
│   │   ├── crypto/           # WebCrypto PBKDF2, AES-GCM, SHA-256, chunking
│   │   ├── pages/            # Dashboard, Upload, Files, Activity, Architecture
│   │   └── App.tsx           # Application layout and routing
│   └── package.json
│
├── docs-site/                # Static documentation & portfolio site for S3 + CloudFront
│   └── index.html
│
├── .env.example              # Environment variables template
└── README.md
```

---

## 3. Local Development Commands (Windows PowerShell)

### Run Backend API:
```powershell
cd c:\Users\rosha\shardsafe\backend
npm.cmd run dev
```
*API will start on `http://localhost:5000` with real health telemetry at `/api/health`.*

### Run Frontend Application:
```powershell
cd c:\Users\rosha\shardsafe\frontend
npm.cmd run dev
```
*Vite dev server will start on `http://localhost:5173` with proxy to the backend API.*

### Run Automated Tests:
```powershell
# Backend API tests (14 tests)
npm.cmd --prefix backend test

# Frontend WebCrypto unit tests (5 tests)
npm.cmd --prefix frontend test
```

---

## 4. Initial AWS Pricing & Cost Considerations (Mumbai Region `ap-south-1`)

| AWS Service | Deployment Tier | Estimated Monthly Cost (Free Tier Eligible) |
| :--- | :--- | :--- |
| **Amazon EC2** | `t3.micro` or `t2.micro` | **$0.00** (750 hours/month free for 12 months on Free Tier; ~$7.50/mo standard) |
| **Amazon RDS** | `db.t3.micro` / `db.t4g.micro` PostgreSQL | **$0.00** (750 hours/month free on 12-month Free Tier; ~$14.00/mo standard) |
| **Amazon S3** | Standard Storage (< 1 GB) | **< $0.05** (5 GB Free Tier; $0.023 per GB/mo) |
| **Amazon CloudFront** | 1 Distribution (Docs Site) | **$0.00** (1 TB data transfer out free indefinitely under AWS Always Free) |
| **Total Estimated Demo Cost** | | **$0.00 to < $2.00** for college testing and demonstration |
