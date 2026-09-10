# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy the entire workspace
COPY package.json package-lock.json ./
COPY api-gateway/package.json ./api-gateway/
COPY authentication/package.json ./authentication/
COPY user/package.json ./user/

# Copy prisma schema if it exists in the root or a shared folder to generate client
# Assuming prisma is in the root or one of the packages. Let's copy everything since it's a monorepo
COPY . .

# Install dependencies (will install for all workspaces)
RUN npm install

# Generate Prisma Client (Assumes schema is in prisma/ or shared folder)
# We run the build script which triggers prisma generate and nest build for all workspaces
RUN npm run build

# --- Production Stage ---
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY api-gateway/package.json ./api-gateway/
COPY authentication/package.json ./authentication/
COPY user/package.json ./user/

# Install only production dependencies
# RUN npm ci --omit=dev  // For monorepos, sometimes it's easier to just copy the whole node_modules from builder if prisma is involved
# To ensure prisma client and all workspace links work perfectly, we'll copy the builder's node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api-gateway/node_modules ./api-gateway/node_modules
COPY --from=builder /app/authentication/node_modules ./authentication/node_modules
COPY --from=builder /app/user/node_modules ./user/node_modules

# Copy built dist folders
COPY --from=builder /app/api-gateway/dist ./api-gateway/dist
COPY --from=builder /app/authentication/dist ./authentication/dist
COPY --from=builder /app/user/dist ./user/dist

# Copy the start script
COPY start.sh ./
RUN chmod +x start.sh

# Expose API Gateway port
EXPOSE 4000

# Start all 3 services using the shell script
CMD ["./start.sh"]
