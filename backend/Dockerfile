# Production Node.js LTS Container for SmartQueue Backend API & Worker
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production || npm install --omit=dev

# Copy application source code
COPY . .

# Adjust permissions for non-root node user
RUN chown -R node:node /app

# Switch to non-root user for security hardening
USER node

# Expose backend application port
EXPOSE 5000

# Default command runs Express API server (Overridden in docker-compose for worker service)
CMD ["npm", "start"]
