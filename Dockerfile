# Multi-stage build for Node.js application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    cp -R node_modules /tmp/node_modules && \
    npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Copy views (EJS templates) to dist directory
RUN cp -r src/views dist/views

# Production stage
FROM node:20-alpine

# Create app user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

# Set working directory
WORKDIR /usr/src/app

# Copy built application from builder
COPY --from=builder --chown=appuser:appuser /usr/src/app/dist ./dist
COPY --from=builder --chown=appuser:appuser /tmp/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /usr/src/app/package*.json ./
COPY --from=builder --chown=appuser:appuser /usr/src/app/migrations ./migrations
COPY --from=builder --chown=appuser:appuser /usr/src/app/public ./public

# Create uploads directory
RUN mkdir -p uploads && chown appuser:appuser uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
