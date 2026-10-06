const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = process.env.ORBIT_UPLOADS || path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.txt', '.md', '.csv']);

function extensionAllowed(filename) {
  return ALLOWED.has(path.extname(filename).toLowerCase());
}

// Attachments are stored under a random name; the display name stays in the database.
function storedPath(storedName) {
  return path.join(UPLOAD_DIR, storedName);
}

module.exports = { UPLOAD_DIR, extensionAllowed, storedPath };
