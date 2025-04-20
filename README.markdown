# NAS Web Server

A web-based file manager for Network Attached Storage (NAS) systems, allowing users to upload, download, and manage files and folders via a browser interface. Built with Node.js, Express, and Docker, this application provides a clean UI with grid and list views, media previews (images and videos), and folder management capabilities.

## Features
- **File and Folder Management**: Upload multiple files, create/rename/delete folders, and delete files.
- **View Modes**: Toggle between grid and list views for file browsing.
- **Media Previews**: Preview images and videos in a modal with thumbnails generated for media files.
- **Bulk Download**: Select multiple files and download them as a ZIP archive.
- **Progress Tracking**: Visual progress bar for file uploads.
- **Responsive Design**: Works on desktop and mobile browsers.

## File Structure
```
nas-web-server/
├── docker-compose.yml    # Docker Compose configuration for running the app
├── Dockerfile           # Dockerfile for building the Node.js app image
├── package.json         # Node.js dependencies and scripts
├── server.js            # Backend server logic (Express.js)
├── data/                # Directory for runtime data (not persisted, empty in repo)
├── public/              # Static files served to the client
│   ├── favicon.ico      # Favicon for the web app (ICO format)
│   ├── favicon.png      # Favicon for the web app (PNG format)
│   ├── index.html       # Main HTML file for the web interface
│   ├── script.js        # Frontend JavaScript logic
│   └── styles.css       # CSS styles for the web interface
```

## Prerequisites
- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.
- [Node.js](https://nodejs.org/) (optional, only if you want to run without Docker).
- A NAS or local storage directory to mount as a volume for file storage.

## Installation

### Using Docker (Recommended)
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ashiva99/nas-web-server.git
   cd nas-web-server
   ```

2. **Set Up the Storage Volume**:
   - The app uses a Docker volume to persist files. By default, it mounts `./data` to `/nas-files` in the container.
   - If you want to use a different directory (e.g., your NAS storage), update the `docker-compose.yml` volume mapping:
     ```yaml
     volumes:
       - /path/to/your/nas/storage:/nas-files
     ```

3. **Build and Run the Application**:
   ```bash
   docker-compose up --build
   ```
   - This will build the Docker image and start the container.
   - The app will be available at `http://localhost:3000`.

4. **Stop the Application**:
   ```bash
   docker-compose down
   ```

### Without Docker (Local Node.js Setup)
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/nas-web-server.git
   cd nas-web-server
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Storage Directory**:
   - The app stores files in `/nas-files`. Create a directory or symlink:
     ```bash
     mkdir -p data
     ln -s $(pwd)/data /nas-files
     ```
   - Alternatively, modify `server.js` to use a different directory by changing the `storageDir` variable.

4. **Run the Application**:
   ```bash
   node server.js
   ```
   - The app will be available at `http://localhost:3000`.

## Usage
1. Open your browser and navigate to `http://localhost:3000`.
2. **Browse Files**:
   - Use the grid or list view to browse files and folders.
   - Click on a folder to navigate inside it.
   - Use the "Back" button to return to the parent directory.
3. **Upload Files**:
   - Click the file input to select one or multiple files.
   - Click "Upload File(s)" to upload. A progress bar will show the upload status.
4. **Manage Files and Folders**:
   - Create a new folder using the "Create Folder" button.
   - Rename or delete folders using the respective buttons.
   - Delete files or download them individually.
   - Select multiple files using checkboxes and click "Download Selected" to download them as a ZIP.
5. **Preview Media**:
   - Click on an image or video thumbnail in the grid view to open a preview modal.
   - Videos can be played with controls; images are displayed directly.

## Dependencies
- **Node.js/Express**: Backend framework for handling HTTP requests.
- **Multer**: Middleware for handling file uploads.
- **Sharp**: Image processing for generating thumbnails.
- **Fluent-FFmpeg**: Video processing for generating video thumbnails.
- **Archiver**: For creating ZIP files for bulk downloads.
- **Mime-types**: For detecting file types.

See `package.json` for the full list of dependencies.

## Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make your changes and commit (`git commit -m "Add your feature"`).
4. Push to your branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Troubleshooting
- **Upload Fails**: Check the browser console and Docker logs (`docker logs <container_name>`) for errors. Ensure the `/nas-files` directory is writable.
- **Thumbnails Not Generating**: Ensure `sharp` and `fluent-ffmpeg` dependencies are installed correctly. Check Docker logs for errors.
- **404 Errors for Favicon**: Ensure `favicon.png` or `favicon.ico` is in the `public` directory.

## Future Improvements
- Add user authentication for secure access.
- Support for more file types in previews (e.g., PDFs).
- Drag-and-drop file uploads.
- Search functionality for files and folders.

---
I used few references and AI assistance for troubleshooting. Bulidling this NAS web application is purely my idea. I'm running this in my old laptop in local network for my home usage. My family liked this interface and they are using it for uploading and downloading the files. Hope you will like it. You can clone this application if needed. 

By
Shiva A