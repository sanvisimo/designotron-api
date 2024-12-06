FROM node:22

WORKDIR /app

RUN apt-get update \
    && apt-get install -y ffmpeg wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable pnpm && corepack use pnpm

COPY ./fonts/*.* /usr/local/share/fonts

RUN npm install -g @nestjs/cli

COPY package.json ./

RUN pnpm install

COPY . .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 3000

CMD [ "pnpm", "run", "start:dev" ]
