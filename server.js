const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const archiver = require('archiver');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const port = 3000;

// Directory to serve as NAS storage (mapped via Docker volume)
const storageDir = '/nas-files';
const thumbnailDir = path.join(storageDir, '.thumbnails');

// Ensure directories exist
fs.mkdir(storageDir, { recursive: true }).then(() => {
  console.log(`Storage directory ensured: ${storageDir}`);
}).catch(err => console.error(`Error creating storage directory: ${err}`));
fs.mkdir(thumbnailDir, { recursive: true }).then(() => {
  console.log(`Thumbnail directory ensured: ${thumbnailDir}`);
}).catch(err => console.error(`Error creating thumbnail directory: ${err}`));

// Configure Multer for file uploads with permissions
const upload = multer({
  dest: storageDir,
  fileFilter: (req, file, cb) => {
    cb(null, true); // Accept all files
  }
}).single('file');

// Handle favicon.ico requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route to list files and folders with enhanced metadata
app.get('/files', async (req, res) => {
  const rawPath = req.query.path || '';
  const dirPath = rawPath ? path.join(storageDir, rawPath) : storageDir;
  console.log(`[GET /files] Requested path: "${rawPath}", Resolved path: "${dirPath}"`);
  try {
    const dirContents = await fs.readdir(dirPath, { withFileTypes: true });
    console.log(`[GET /files] Raw directory contents (${dirContents.length} items):`, dirContents.map(item => item.name));
    
    const fileList = await Promise.all(dirContents.map(async (file) => {
      if (file.name.startsWith('.')) {
        console.log(`[GET /files] Skipping hidden file: ${file.name}`);
        return null;
      }
      const fullPath = path.join(dirPath, file.name);
      try {
        const stats = await fs.stat(fullPath);
        const mimeType = file.isDirectory() ? 'directory' : (mime.lookup(fullPath) || 'unknown');
        console.log(`[GET /files] File: ${file.name}, Type: ${mimeType}, Size: ${stats.size}, Modified: ${stats.mtime}`);
        return {
          name: file.name,
          isDirectory: file.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          type: mimeType,
          isMedia: mimeType.startsWith('image/') || mimeType.startsWith('video/')
        };
      } catch (statErr) {
        console.error(`[GET /files] Error getting stats for ${fullPath}:`, statErr);
        return null;
      }
    }));

    const filteredList = fileList.filter(file => file !== null);
    console.log(`[GET /files] Returning ${filteredList.length} items:`, filteredList.map(item => item.name));
    res.json(filteredList);
  } catch (err) {
    console.error(`[GET /files] Error reading directory ${dirPath}:`, err);
    res.status(500).json({ error: 'Unable to read directory', details: err.message });
  }
});

// Route to generate and serve thumbnails
app.get('/thumbnail', async (req, res) => {
  const filePath = path.join(storageDir, decodeURIComponent(req.query.path));
  const thumbPath = path.join(thumbnailDir, `${req.query.path.replace(/\//g, '_')}.jpg`);
  console.log(`[GET /thumbnail] Requested thumbnail for: ${filePath}`);

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      console.log(`[GET /thumbnail] Cannot generate thumbnail for directory`);
      return res.status(400).json({ error: 'Cannot generate thumbnail for directory' });
    }

    // Check if thumbnail exists
    try {
      await fs.access(thumbPath);
      console.log(`[GET /thumbnail] Serving cached thumbnail: ${thumbPath}`);
      return res.sendFile(thumbPath);
    } catch {
      // Generate thumbnail
      const mimeType = mime.lookup(filePath) || 'unknown';
      if (mimeType.startsWith('image/')) {
        console.log(`[GET /thumbnail] Generating image thumbnail for: ${filePath}`);
        await sharp(filePath)
          .resize(150, 150, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } else if (mimeType.startsWith('video/')) {
        console.log(`[GET /thumbnail] Generating video thumbnail for: ${filePath}`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .screenshots({
              count: 1,
              folder: thumbnailDir,
              filename: path.basename(thumbPath),
              size: '150x150'
            })
            .on('end', () => {
              console.log(`[GET /thumbnail] Video thumbnail generated: ${thumbPath}`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`[GET /thumbnail] Video thumbnail error:`, err);
              reject(err);
            });
        });
      } else {
        console.log(`[GET /thumbnail] File is not an image or video: ${mimeType}`);
        return res.status(400).json({ error: 'File is not an image or video' });
      }
      // Check if thumbnail was generated successfully before sending
      await fs.access(thumbPath);
      res.sendFile(thumbPath);
    }
  } catch (err) {
    console.error(`[GET /thumbnail] Thumbnail error for ${filePath}:`, err);
    res.status(500).json({ error: 'Thumbnail generation failed', details: err.message });
  }
});

// Route to handle file uploads
app.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('[POST /upload] Upload error:', err);
      return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
    const rawPath = req.body.path || '';
    const dirPath = rawPath ? path.join(storageDir, rawPath) : storageDir;
    const file = req.file;

    if (!file) {
      console.error('[POST /upload] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Ensure the target directory exists
      await fs.mkdir(dirPath, { recursive: true });
      const newPath = path.join(dirPath, file.originalname);
      console.log(`[POST /upload] Uploading to: ${newPath}, from temp: ${file.path}`);
      await fs.rename(file.path, newPath);
      await fs.chmod(newPath, 0o666);
      console.log(`[POST /upload] Successfully uploaded: ${newPath}`);
      res.json({ message: 'File uploaded successfully' });
    } catch (err) {
      console.error(`[POST /upload] Error moving file to ${newPath}:`, err);
      res.status(500).json({ error: 'Upload failed', details: err.message });
    }
  });
});

// Route to create a new folder
app.post('/create-folder', async (req, res) => {
  const folderPath = decodeURIComponent(req.body.path || '');
  const fullPath = path.join(storageDir, folderPath);
  console.log(`[POST /create-folder] Creating folder: ${fullPath}`);
  try {
    await fs.mkdir(fullPath, { recursive: true });
    await fs.chmod(fullPath, 0o777);
    console.log(`[POST /create-folder] Successfully created: ${fullPath}`);
    res.json({ message: 'Folder created successfully' });
  } catch (err) {
    console.error(`[POST /create-folder] Error creating folder ${fullPath}:`, err);
    if (err.code === 'EEXIST') {
      res.status(400).json({ error: 'Folder already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create folder', details: err.message });
    }
  }
});

// Route to rename a folder
app.post('/rename-folder', async (req, res) => {
  const oldPath = decodeURIComponent(req.body.oldPath || '');
  const newPath = decodeURIComponent(req.body.newPath || '');
  const fullOldPath = path.join(storageDir, oldPath);
  const fullNewPath = path.join(storageDir, newPath);
  console.log(`[POST /rename-folder] Renaming folder from ${fullOldPath} to ${fullNewPath}`);
  try {
    const stats = await fs.stat(fullOldPath);
    if (!stats.isDirectory()) {
      console.log(`[POST /rename-folder] Old path is not a directory`);
      return res.status(400).json({ error: 'Old path is not a directory' });
    }
    await fs.rename(fullOldPath, fullNewPath);
    console.log(`[POST /rename-folder] Successfully renamed to: ${fullNewPath}`);
    res.json({ message: 'Folder renamed successfully' });
  } catch (err) {
    console.error(`[POST /rename-folder] Error renaming folder:`, err);
    if (err.code === 'EEXIST') {
      res.status(400).json({ error: 'A folder with the new name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to rename folder', details: err.message });
    }
  }
});

// Route to delete a folder
app.delete('/delete-folder', async (req, res) => {
  const folderPath = decodeURIComponent(req.query.path || '');
  const fullPath = path.join(storageDir, folderPath);
  console.log(`[DELETE /delete-folder] Deleting folder: ${fullPath}`);
  try {
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      console.log(`[DELETE /delete-folder] Path is not a directory`);
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    await fs.rm(fullPath, { recursive: true, force: true });
    console.log(`[DELETE /delete-folder] Successfully deleted: ${fullPath}`);
    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    console.error(`[DELETE /delete-folder] Error deleting folder ${fullPath}:`, err);
    res.status(500).json({ error: 'Failed to delete folder', details: err.message });
  }
});

// Route to download a single file
app.get('/download', async (req, res) => {
  const filePath = path.join(storageDir, decodeURIComponent(req.query.path));
  console.log(`[GET /download] Downloading: ${filePath}`);
  
  try {
    // Check if the file exists before attempting to download
    await fs.access(filePath);
    res.download(filePath);
  } catch (err) {
    console.error(`[GET /download] Download error for ${filePath}:`, err);
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

// Route to download multiple files as a ZIP
app.get('/download-multiple', async (req, res) => {
  const filePaths = Array.isArray(req.query.paths) ? req.query.paths : [req.query.paths].filter(Boolean);
  console.log(`[GET /download-multiple] Files requested: ${filePaths}`);
  if (!filePaths.length) {
    console.log(`[GET /download-multiple] No files selected`);
    return res.status(400).json({ error: 'No files selected' });
  }

  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=files.zip');
    archive.pipe(res);

    for (const filePath of filePaths) {
      const fullPath = path.join(storageDir, decodeURIComponent(filePath));
      const stats = await fs.stat(fullPath);
      if (!stats.isDirectory()) {
        console.log(`[GET /download-multiple] Adding to ZIP: ${fullPath}`);
        archive.file(fullPath, { name: path.basename(decodeURIComponent(filePath)) });
      }
    }

    archive.finalize();
    console.log(`[GET /download-multiple] ZIP creation complete`);
  } catch (err) {
    console.error('[GET /download-multiple] ZIP creation error:', err);
    res.status(500).json({ error: 'Failed to create ZIP', details: err.message });
  }
});

// Route to delete files
app.delete('/delete', async (req, res) => {
  const filePath = path.join(storageDir, decodeURIComponent(req.query.path));
  console.log(`[DELETE /delete] Deleting: ${filePath}`);
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      console.log(`[DELETE /delete] Cannot delete directories`);
      return res.status(400).json({ error: 'Cannot delete directories' });
    }
    await fs.unlink(filePath);
    const thumbPath = path.join(thumbnailDir, `${req.query.path.replace(/\//g, '_')}.jpg`);
    await fs.unlink(thumbPath).catch(() => {});
    console.log(`[DELETE /delete] Deleted: ${filePath}`);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error(`[DELETE /delete] Delete error for ${filePath}:`, err);
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});