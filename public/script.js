let currentPath = '';
let selectedFiles = [];
let currentView = 'grid';
let currentFolderPath = '';

async function loadFiles(path = '') {
  currentPath = path ? path.replace(/\/+/g, '/').replace(/\/$/, '') : '';
  console.log(`[loadFiles] Loading files for path: "${currentPath}"`);
  document.getElementById('path').textContent = `Current Path: /${currentPath}`;
  document.getElementById('selectAll').checked = false;
  selectedFiles = [];

  const backButtonContainer = document.getElementById('backButtonContainer');
  if (currentPath) {
    backButtonContainer.style.display = 'block';
  } else {
    backButtonContainer.style.display = 'none';
  }

  try {
    const response = await fetch(`/files?path=${encodeURIComponent(currentPath)}`, {
      cache: 'no-store'
    });
    console.log(`[loadFiles] Fetch response status: ${response.status}`);
    const responseText = await response.text();
    console.log(`[loadFiles] Raw response: ${responseText}`);

    let files;
    try {
      files = JSON.parse(responseText);
    } catch (parseErr) {
      throw new Error(`Failed to parse response as JSON: ${parseErr.message}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${files.error || responseText}`);
    }
    console.log(`[loadFiles] Parsed ${files.length} files:`, files);

    const fileList = document.getElementById('fileList');
    const fileListBody = fileList.querySelector('tbody'); // Target the tbody
    fileListBody.innerHTML = ''; // Clear only the tbody

    const fileGrid = document.getElementById('fileGrid');
    fileGrid.innerHTML = '';

    if (files.length === 0) {
      console.log(`[loadFiles] No files found in path: "${currentPath}"`);
      fileListBody.innerHTML = '<tr><td colspan="6">No files found</td></tr>';
      fileGrid.innerHTML = '<div class="file-item">No files found</div>';
      return;
    }

    files.forEach((file, index) => {
      console.log(`[loadFiles] Processing file ${index + 1}/${files.length}: ${file.name}`);
      try {
        const filePath = encodeURIComponent((currentPath ? currentPath + '/' : '') + file.name);
        console.log(`[loadFiles] File path: ${filePath}`);

        // List view row
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            ${file.isDirectory ? '' : `
              <input type="checkbox" class="file-checkbox" data-path="${filePath}">
            `}
          </td>
          <td>
            ${file.isDirectory ? 
              `<a href="#" class="folder-link" data-path="${(currentPath ? currentPath + '/' : '') + file.name}">${file.name}</a>` : 
              file.name}
          </td>
          <td>${file.type || 'unknown'}</td>
          <td>${file.isDirectory ? '-' : (file.size / 1024).toFixed(2) + ' KB'}</td>
          <td>${file.modified ? new Date(file.modified).toLocaleString() : 'N/A'}</td>
          <td>
            ${file.isDirectory ? `
              <button class="rename-btn" data-path="${filePath}">Rename</button>
              <button class="delete-btn" data-path="${filePath}">Delete</button>
            ` : `
              <button class="download-btn" onclick="downloadFile('${filePath}')">Download</button>
              <button class="delete-btn" data-path="${filePath}">Delete</button>
              <button class="metadata-btn" data-file='${JSON.stringify(file).replace(/'/g, "'")}'>Metadata</button>
            `}
          </td>
        `;
        fileListBody.appendChild(row);

        if (file.isDirectory) {
          const folderLink = row.querySelector('.folder-link');
          folderLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadFiles(folderLink.getAttribute('data-path'));
          });

          const renameBtn = row.querySelector('.rename-btn');
          renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentFolderPath = renameBtn.getAttribute('data-path');
            showRenameFolderModal();
          });

          const deleteBtn = row.querySelector('.delete-btn');
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFolder(deleteBtn.getAttribute('data-path'));
          });
        } else {
          const deleteBtn = row.querySelector('.delete-btn');
          deleteBtn.addEventListener('click', () => deleteFile(deleteBtn.getAttribute('data-path')));
          
          const metadataBtn = row.querySelector('.metadata-btn');
          metadataBtn.addEventListener('click', () => {
            const fileData = JSON.parse(metadataBtn.getAttribute('data-file'));
            showMetadata(fileData);
          });

          const checkbox = row.querySelector('.file-checkbox');
          if (checkbox) {
            checkbox.addEventListener('change', () => toggleFileSelection(checkbox));
          }
        }

        // Grid view item
        const gridItem = document.createElement('div');
        gridItem.className = 'file-item';
        gridItem.innerHTML = `
          ${file.isDirectory ? '' : `
            <input type="checkbox" class="file-checkbox" data-path="${filePath}">
          `}
          ${file.isMedia ? `
            <img src="/thumbnail?path=${filePath}" class="thumbnail" alt="${file.name}" onerror="this.src=''; this.className='file-icon'; this.innerHTML='📄';">
          ` : `
            <div class="file-icon">${file.isDirectory ? '📁' : '📄'}</div>
          `}
          <div class="file-name">${file.name}</div>
          ${file.isDirectory ? `
            <div class="file-actions">
              <button class="rename-btn" data-path="${filePath}">Rename</button>
              <button class="delete-btn" data-path="${filePath}">Delete</button>
            </div>
            <a href="#" class="folder-link" data-path="${(currentPath ? currentPath + '/' : '') + file.name}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></a>
          ` : `
            <div class="file-actions">
              <button class="download-btn" onclick="downloadFile('${filePath}')">Download</button>
              <button class="delete-btn" data-path="${filePath}">Delete</button>
            </div>
          `}
        `;
        fileGrid.appendChild(gridItem);

        if (file.isDirectory) {
          const folderLink = gridItem.querySelector('.folder-link');
          folderLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadFiles(folderLink.getAttribute('data-path'));
          });

          const renameBtn = gridItem.querySelector('.rename-btn');
          renameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentFolderPath = renameBtn.getAttribute('data-path');
            showRenameFolderModal();
          });

          const deleteBtn = gridItem.querySelector('.delete-btn');
          deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteFolder(deleteBtn.getAttribute('data-path'));
          });
        } else {
          const deleteBtn = gridItem.querySelector('.delete-btn');
          deleteBtn.addEventListener('click', () => deleteFile(deleteBtn.getAttribute('data-path')));
          
          const checkbox = gridItem.querySelector('.file-checkbox');
          if (checkbox) {
            checkbox.addEventListener('change', () => toggleFileSelection(checkbox));
          }

          const thumbnail = gridItem.querySelector('.thumbnail');
          if (thumbnail && file.isMedia) {
            thumbnail.style.cursor = 'pointer';
            thumbnail.addEventListener('click', () => {
              if (file.type.startsWith('video/')) {
                showVideo(filePath);
              } else if (file.type.startsWith('image/')) {
                showImage(filePath);
              }
            });
          }
        }

        console.log(`[loadFiles] Successfully rendered file ${index + 1}/${files.length}: ${file.name}`);
      } catch (renderErr) {
        console.error(`[loadFiles] Error rendering file ${file.name}:`, renderErr);
      }
    });

    console.log(`[loadFiles] List view items: ${fileListBody.children.length}`);
    console.log(`[loadFiles] Grid view items: ${fileGrid.children.length}`);

    const computedStyle = window.getComputedStyle(fileGrid);
    console.log(`[loadFiles] fileGrid display style: ${computedStyle.display}`);
    console.log(`[loadFiles] fileGrid visibility: ${computedStyle.visibility}`);
    console.log(`[loadFiles] fileGrid opacity: ${computedStyle.opacity}`);

    setView(currentView); // Use currentView to maintain the selected view
  } catch (error) {
    console.error('[loadFiles] Error loading files:', error);
    alert(`Failed to load files: ${error.message}. Check console for details.`);
    const fileList = document.getElementById('fileList');
    const fileListBody = fileList.querySelector('tbody');
    const fileGrid = document.getElementById('fileGrid');
    fileListBody.innerHTML = '<tr><td colspan="6">Error loading files</td></tr>';
    fileGrid.innerHTML = '<div class="file-item">Error loading files</div>';
  }
}

async function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const files = fileInput.files;
  if (!files || files.length === 0) {
    alert('Please select at least one file');
    return;
  }

  const progressBar = document.getElementById('uploadProgress');
  const progressText = document.getElementById('progressText');
  const progressContainer = document.querySelector('.progress-container');
  progressContainer.classList.add('visible');

  let totalFiles = files.length;
  let completedFiles = 0;

  // Calculate total size for overall progress
  let totalSize = 0;
  for (let i = 0; i < files.length; i++) {
    totalSize += files[i].size;
  }
  let totalUploaded = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[uploadFile] Uploading file ${i + 1}/${totalFiles}: ${file.name}`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Update total uploaded size for this file's progress
            const fileUploaded = event.loaded;
            const currentTotalUploaded = totalUploaded + fileUploaded;
            const overallPercent = (currentTotalUploaded / totalSize) * 100;
            progressBar.value = overallPercent;
            progressText.textContent = `${Math.round(overallPercent)}%`;
            console.log(`[uploadFile] Overall upload progress: ${Math.round(overallPercent)}%`);
          }
        };

        xhr.onload = () => {
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status === 200) {
              console.log(`[uploadFile] Upload successful for ${file.name}:`, result);
              completedFiles++;
              totalUploaded += file.size; // Add this file's size to totalUploaded
              resolve();
            } else {
              console.error(`[uploadFile] Upload failed for ${file.name}:`, result);
              reject(new Error(result.error || 'Upload failed'));
            }
          } catch (err) {
            console.error(`[uploadFile] Error parsing response for ${file.name}:`, err, xhr.responseText);
            reject(new Error('Upload failed: Invalid response from server'));
          }
        };

        xhr.onerror = () => {
          console.error(`[uploadFile] Network error during upload of ${file.name}`);
          reject(new Error('Upload failed due to network error'));
        };

        xhr.send(formData);
      });
    } catch (error) {
      console.error(`[uploadFile] Upload error for ${file.name}:`, error);
      alert(`Upload failed for ${file.name}: ${error.message}`);
      // Continue with the next file even if one fails
      completedFiles++;
      totalUploaded += file.size;
    }
  }

  progressContainer.classList.remove('visible');
  if (completedFiles === totalFiles) {
    alert('All files uploaded successfully');
  } else {
    alert('Some files failed to upload. Check console for details.');
  }
  await loadFiles(currentPath);
}

async function deleteFile(filePath) {
  if (!confirm('Are you sure you want to delete this file?')) return;
  try {
    const response = await fetch(`/delete?path=${filePath}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    console.log('[deleteFile] Delete result:', result);
    alert(result.message || result.error);
    await loadFiles(currentPath);
  } catch (error) {
    console.error('[deleteFile] Delete error:', error);
    alert('Delete failed. Check console for details.');
  }
}

async function deleteFolder(folderPath) {
  if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;
  try {
    const decodedPath = decodeURIComponent(folderPath);
    console.log(`[deleteFolder] Deleting folder: ${decodedPath}`);
    const response = await fetch(`/delete-folder?path=${encodeURIComponent(decodedPath)}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    console.log('[deleteFolder] Delete folder result:', result);
    alert(result.message || result.error);
    await loadFiles(currentPath);
  } catch (error) {
    console.error('[deleteFolder] Delete folder error:', error);
    alert('Delete folder failed. Check console for details.');
  }
}

function showMetadata(file) {
  const modal = document.getElementById('metadataModal');
  const content = document.getElementById('metadataContent');
  content.innerHTML = `
    <p><strong>Name:</strong> ${file.name}</p>
    <p><strong>Type:</strong> ${file.type || 'unknown'}</p>
    <p><strong>Size:</strong> ${(file.size / 1024).toFixed(2) + ' KB'}</p>
    <p><strong>Created:</strong> ${file.created ? new Date(file.created).toLocaleString() : 'N/A'}</p>
    <p><strong>Modified:</strong> ${file.modified ? new Date(file.modified).toLocaleString() : 'N/A'}</p>
  `;
  modal.style.display = 'block';
}

function showImage(filePath) {
  const modal = document.getElementById('imageModal');
  const content = document.getElementById('imageContent');
  content.innerHTML = `<img src="/download?path=${filePath}" alt="Image preview">`;
  modal.style.display = 'block';
}

function showVideo(filePath) {
  const modal = document.getElementById('videoModal');
  const content = document.getElementById('videoContent');
  content.innerHTML = `
    <video controls>
      <source src="/download?path=${filePath}" type="video/mp4">
      <source src="/download?path=${filePath}" type="video/webm">
      Your browser does not support the video tag.
    </video>
  `;
  modal.style.display = 'block';
}

function showCreateFolderModal() {
  document.getElementById('newFolderName').value = '';
  document.getElementById('createFolderModal').style.display = 'block';
}

function showRenameFolderModal() {
  document.getElementById('renameFolderName').value = '';
  document.getElementById('renameFolderModal').style.display = 'block';
}

async function createFolder() {
  const folderName = document.getElementById('newFolderName').value.trim();
  if (!folderName) {
    alert('Please enter a folder name');
    return;
  }

  const folderPath = encodeURIComponent((currentPath ? currentPath + '/' : '') + folderName);
  try {
    const response = await fetch('/create-folder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: folderPath })
    });
    const result = await response.json();
    console.log('[createFolder] Create folder result:', result);
    if (response.ok) {
      alert(result.message || 'Folder created successfully');
      closeModal('createFolderModal');
      await loadFiles(currentPath);
    } else {
      alert(result.error || 'Failed to create folder');
    }
  } catch (error) {
    console.error('[createFolder] Create folder error:', error);
    alert('Failed to create folder. Check console for details.');
  }
}

async function renameFolder() {
  const newFolderName = document.getElementById('renameFolderName').value.trim();
  if (!newFolderName) {
    alert('Please enter a new folder name');
    return;
  }

  const oldFolderPath = decodeURIComponent(currentFolderPath);
  const pathSegments = oldFolderPath.split('/');
  pathSegments.pop();
  pathSegments.push(newFolderName);
  const newFolderPath = pathSegments.join('/');

  console.log(`[renameFolder] Renaming from ${oldFolderPath} to ${newFolderPath}`);

  try {
    const response = await fetch('/rename-folder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        oldPath: encodeURIComponent(oldFolderPath), 
        newPath: encodeURIComponent(newFolderPath) 
      })
    });
    const result = await response.json();
    console.log('[renameFolder] Rename folder result:', result);
    if (response.ok) {
      alert(result.message || 'Folder renamed successfully');
      closeModal('renameFolderModal');
      await loadFiles(currentPath);
    } else {
      alert(result.error || 'Failed to rename folder');
    }
  } catch (error) {
    console.error('[renameFolder] Rename folder error:', error);
    alert('Failed to rename folder. Check console for details.');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'none';

  if (modalId === 'videoModal') {
    const video = modal.querySelector('video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }
}

function toggleFileSelection(checkbox) {
  const filePath = checkbox.getAttribute('data-path');
  if (checkbox.checked) {
    selectedFiles.push(filePath);
  } else {
    selectedFiles = selectedFiles.filter(path => path !== filePath);
  }
  console.log('[toggleFileSelection] Selected files:', selectedFiles);
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.file-checkbox');
  selectedFiles = [];
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAll.checked;
    if (checkbox.checked) {
      selectedFiles.push(checkbox.getAttribute('data-path'));
    }
  });
  console.log('[toggleSelectAll] Selected files:', selectedFiles);
}

async function downloadSelected() {
  if (selectedFiles.length === 0) {
    alert('Please select at least one file to download');
    return;
  }

  const query = selectedFiles.map(path => `paths=${path}`).join('&');
  console.log('[downloadSelected] Downloading:', selectedFiles);
  window.location.href = `/download-multiple?${query}`;
}

function setView(view) {
  currentView = view;
  document.getElementById('gridView').classList.toggle('active', view === 'grid');
  document.getElementById('listView').classList.toggle('active', view === 'list');
  document.getElementById('fileContainer').className = `file-container ${view}-view`;
  console.log(`[setView] Switched to ${view} view`);

  const fileGrid = document.getElementById('fileGrid');
  const computedStyle = window.getComputedStyle(fileGrid);
  console.log(`[setView] fileGrid display style after toggle: ${computedStyle.display}`);
}

function refreshFiles() {
  console.log('[refreshFiles] Manually refreshing file list');
  loadFiles(currentPath);
}

function goBack() {
  const parentPath = currentPath.split('/').slice(0, -1).join('/');
  console.log(`[goBack] Navigating to parent path: "${parentPath}"`);
  loadFiles(parentPath);
}

function downloadFile(filePath) {
  window.location.href = `/download?path=${filePath}`;
}

loadFiles();