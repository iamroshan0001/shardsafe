# ShardSafe: Complete Faculty Demonstration & Viva Q&A Guide

## Project Title
**ShardSafe: Secure Cloud File Vault with Block-Level Encryption, Amazon AWS Storage (S3, EC2, RDS), and CDN-Based Documentation Hosting (CloudFront)**

---

## 1. Project Overview & Problem Statement Mapping

### College Problem Statement:
> *"Implement the basic operations such as divide the file into segments/blocks and download file from cloud in encrypted form. Host a portfolio or documentation site using Amazon S3 (AWS). Integrate a Content Delivery Network (CDN) like AWS CloudFront to learn about global content distribution and HTTPS."*

### How ShardSafe Fulfills Every Objective:

| Requirement | Implementation in ShardSafe | AWS Service Used |
|---|---|---|
| **Divide file into segments / blocks** | Slices files client-side into configurable chunk sizes (512 KiB, 1 MiB, 2 MiB) | Browser JavaScript (Blob API) |
| **Client-Side Block Encryption** | Generates PBKDF2 salt, derives 256-bit AES key from secret passphrase, encrypts each block independently with distinct IV | Web Crypto API (AES-GCM-256) |
| **Upload & Store Encrypted Blocks** | Secure direct-to-cloud upload using short-lived Presigned URLs | **Amazon S3** (`shardsafe-vault-2026`) |
| **Download & Reassemble** | Downloads encrypted `.enc` blocks directly from cloud, verifies checksums, decrypts, and reassembles original file | **Amazon S3** + Web Crypto API |
| **Database & Cloud Catalog** | Stores user accounts, file metadata, segment numbers, S3 keys, and audit logs | **Amazon RDS** (PostgreSQL) |
| **Cloud Application Server** | Express/Node.js REST API orchestrating auth, health telemetry, and presigned URLs | **Amazon EC2** (Ubuntu 24.04 LTS) |
| **Documentation & Portfolio Hosting** | Static technical architecture website hosted on cloud storage | **Amazon S3** (`shardsafe-docs-2026`) |
| **Global Content Delivery & HTTPS** | Edge caching with automated SSL/TLS distribution worldwide | **Amazon CloudFront CDN** |

---

## 2. Complete End-to-End System Architecture

```
                                  [ USER BROWSER ]
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        │                                                                 │
  (1) HTTP / API Requests                                      (4) Direct Block Upload / Download
 (Auth, File Catalog, URLs)                                       (Presigned URLs via S3)
        │                                                                 │
        ▼                                                                 ▼
┌───────────────────────────────┐                             ┌───────────────────────────────┐
│        AMAZON EC2             │                             │           AMAZON S3           │
│   (Ubuntu 24.04 LTS)          │                             │        (ap-south-1 Mumbai)    │
│   Port 5000                   │                             ├───────────────────────────────┤
│                               │                             │ Bucket 1:                     │
│  • Node.js / Express API      │                             │ shardsafe-vault-2026          │
│  • Presigned URL Generator    │                             │ (Encrypted .enc chunks)       │
│  • Health & Metrics Telemetry │                             │                               │
└───────────────┬───────────────┘                             │ Bucket 2:                     │
                │                                             │ shardsafe-docs-2026           │
         (2) SQL Queries                                      │ (Documentation Website)       │
         (PostgreSQL 5432)                                    └───────────────┬───────────────┘
                │                                                             │
                ▼                                                             │ (5) Global CDN Cache
┌───────────────────────────────┐                                             ▼
│          AMAZON RDS           │                             ┌───────────────────────────────┐
│   PostgreSQL Engine           │                             │       AMAZON CLOUDFRONT       │
│                               │                             │         (Global CDN)          │
│  • users                      │                             ├───────────────────────────────┤
│  • files                      │                             │ • HTTPS / SSL Termination     │
│  • file_segments              │                             │ • Global Edge Caching         │
│  • activity_logs              │                             │ • Sub-millisecond latency     │
└───────────────────────────────┘                             └───────────────────────────────┘
```

---

## 3. Step-by-Step Live Faculty Demonstration Script (5 Minutes)

### Phase 1: Show Cloud Health Telemetry (30 Seconds)
1. Open your browser and navigate to:
   `http://localhost:5000/api/health`
2. **What to say to faculty**:
   > *"Sir/Ma'am, here is the live telemetry endpoint. As you can see in the JSON response, our database is connected directly to Amazon RDS PostgreSQL (`isRealRDS: true`), and our block storage is connected to Amazon S3 (`isRealS3: true`)."*

### Phase 2: Demonstrate Block Segmentation & Live Upload (2 Minutes)
1. Open the frontend UI at your CloudFront URL:
   `https://d2uik681lagcwn.cloudfront.net` (in Brave Browser).
2. Log in with `roshan@gmail.com` or create an account.
3. Click **Upload to Secure Vault**.
4. Select a **3 MB to 5 MB file** (e.g., a PDF document or high-resolution image).
5. Point to the **Block Size** option:
   - Select **`1 MiB`** (file will divide into 3–5 blocks) or **`512 KiB`**.
6. Enter a secret passphrase (e.g. `MyProjectSecret2026!`).
7. Click **Encrypt & Vault File**:
8. **What to point out on screen**:
   - Show the interactive block matrix turn colors in real time:
     - 🟦 Blue: File is sliced into segments.
     - 🟨 Amber: Encrypting block client-side with AES-256-GCM.
     - 🟩 Green: Uploading block directly to Amazon S3 via presigned PUT URL.

### Phase 3: Prove Cloud Storage in AWS Console (1 Minute)
1. Open the [AWS S3 Console](https://s3.console.aws.amazon.com/s3/buckets/shardsafe-vault-2026?region=ap-south-1) for `shardsafe-vault-2026`.
2. Click **Refresh**.
3. Show the newly created folder matching the file ID with today's timestamp.
4. Open the folder and show the separate chunks:
   - `part_1.enc`
   - `part_2.enc`
   - `part_3.enc`
5. **Key Security Point**: Download `part_1.enc` and open in Notepad:
   > *"Even with full administrative access to the AWS S3 console, the cloud provider only sees unreadable ciphertext. The raw file is never transmitted or stored intact."*

### Phase 4: Prove CloudFront CDN & Global HTTPS (1 Minute)
1. Open your CloudFront distribution domain:
   `https://d2uik681lagcwn.cloudfront.net`
2. Show the ShardSafe frontend application loading over secure HTTPS edge delivery.
3. Press **F12** ➔ Open the **Network** tab ➔ Refresh the page.
4. Click the request and point to the HTTP response header:
   - **`x-cache: Hit from cloudfront`**
5. **What to say**:
   > *"This response header confirms that AWS CloudFront's global edge server cached and delivered our content over HTTPS without querying the origin bucket again."*

### Phase 5: Demonstrate Download & Client-Side Decryption (30 Seconds)
1. Return to the app's **Vault** page.
2. Click **Download** on the uploaded file.
3. Enter the secret passphrase.
4. The browser downloads all `.enc` blocks from S3, decrypts each block, and triggers the browser download with the original filename and exact size.

---

## 4. Comprehensive Faculty Viva / Oral Exam Q&A

### Q1: Why divide files into blocks instead of uploading the whole file directly?
**Answer**:
Dividing files into blocks offers three major advantages:
1. **Security**: An attacker compromising one block gains no knowledge of the rest of the file. Each block has a distinct Initialization Vector (IV).
2. **Reliability & Fault Tolerance**: If a network failure occurs during upload, only the failed 1 MiB chunk needs to be re-uploaded, rather than re-transmitting a large 50 MB file.
3. **Parallelism**: Blocks can be encrypted and uploaded concurrently across multiple worker threads, improving throughput.

---

### Q2: What encryption algorithm is used, and where does encryption happen?
**Answer**:
We use **AES-256-GCM (Galois/Counter Mode)**. Encryption occurs **strictly on the client side (in the user's browser)** using the native Web Crypto API.
- The user's secret passphrase is transformed into a 256-bit key using **PBKDF2-HMAC-SHA-256** with 100,000 iterations and a unique 16-byte cryptographic salt.
- The plaintext file and passphrase **never touch the cloud backend or S3**; only encrypted ciphertext is sent to AWS.

---

### Q3: What is a Presigned URL in Amazon S3, and why did you use it?
**Answer**:
A presigned URL is a time-limited (15-minute) authenticated URL generated by our backend using AWS IAM credentials.
- **Why we use it**: It allows the user's browser to upload encrypted blocks **directly to Amazon S3** (`Browser ➔ S3`) without passing huge file streams through our EC2 server (`Browser ➔ EC2 ➔ S3`).
- This prevents our EC2 instance from becoming a network bottleneck and drastically reduces server bandwidth and memory usage.

---

### Q4: What is the purpose of Amazon CloudFront in this project?
**Answer**:
Amazon CloudFront is a Content Delivery Network (CDN) with hundreds of Point of Presence (PoP) edge locations worldwide.
1. It caches our S3 documentation website physically close to global users, reducing latency from hundreds of milliseconds to under 10 ms.
2. It provides free, automated **HTTPS / SSL encryption**, securing the static website against interception.
3. It protects the origin S3 bucket by absorbing traffic spikes at the edge.

---

### Q5: What database schema are you using in Amazon RDS?
**Answer**:
We use PostgreSQL on Amazon RDS with 4 relational tables:
1. `users`: Stores user authentication credentials (passwords hashed with `bcrypt`).
2. `files`: Stores high-level file metadata (filename, original size, total block count, salt).
3. `file_segments`: Stores individual block records (block number, S3 object key, IV, SHA-256 checksum).
4. `activity_logs`: Stores audit trails of upload/download operations with timestamps.

---

### Q6: How did you implement Cloud Cost Optimization (FinOps)?
**Answer**:
Cloud cost management is essential in production environments:
1. **On-Demand Compute**: We keep EC2 and RDS instances in a **Stopped** state during development and only start them during active demonstration, reducing compute costs by over 95%.
2. **Free-Tier Utilization**: S3 standard storage and CloudFront (1 TB/month free) are leveraged for storage and distribution.
3. **Stateless Backend**: The architecture is decoupled so the backend can be terminated or auto-scaled without losing any stored file blocks in S3.

---

### Q7: What happens if someone tries to download the file with an incorrect passphrase?
**Answer**:
Because we use **AES-GCM**, which provides authenticated encryption with an integrity tag, attempting decryption with an incorrect passphrase fails immediately during the cryptographic authentication tag verification. The file is never decrypted, and an error is shown.
