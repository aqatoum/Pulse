FROM node:20-alpine

WORKDIR /app

# تثبيت dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# نسخ الكود
COPY . .

# إعدادات Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/server.js"]
