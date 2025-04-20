# Use the official Node.js 18 image as the base
FROM node:18

# Install FFmpeg for video thumbnail generation
RUN apt-get update && apt-get install -y ffmpeg

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]