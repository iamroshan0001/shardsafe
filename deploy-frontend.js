const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require(path.join(__dirname, 'backend', 'node_modules', '@aws-sdk', 'client-s3'));
require(path.join(__dirname, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, 'backend', '.env') });

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_DOCS_BUCKET || 'shardsafe-docs-2026';
const DIST_DIR = path.join(__dirname, 'frontend', 'dist');

const getContentType = (filePath) => {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
};

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory ${dirPath} does not exist. Please run frontend build first!`);
  }
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

async function deploy() {
  console.log(`Deploying frontend from ${DIST_DIR} to S3 bucket: ${BUCKET}...`);
  const files = getAllFiles(DIST_DIR);
  for (const file of files) {
    const relativeKey = path.relative(DIST_DIR, file).split(path.sep).join('/');
    const content = fs.readFileSync(file);
    const contentType = getContentType(file);
    console.log(` -> Uploading ${relativeKey} (${contentType}, ${content.length} bytes)`);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: relativeKey,
      Body: content,
      ContentType: contentType,
    }));
  }
  console.log('\nDeployment complete! All frontend files are live in S3.');
}

deploy().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
