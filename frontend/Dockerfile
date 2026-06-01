# ========================================================
# Construction Manager v3 - Frontend (Next.js 14)
# Google Drive 上のため bind mount 非対応。コード変更後は --build で再ビルドする。
# ========================================================
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
