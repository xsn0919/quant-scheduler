FROM node:20-slim

RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates procps libxss1 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# 创建非 root 用户运行 (安全实践)
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /app /home/pptruser
USER pptruser

EXPOSE 8080

CMD ["npm", "start"]
