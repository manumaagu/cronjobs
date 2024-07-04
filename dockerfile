FROM node:20.11.1

WORKDIR /app

COPY package.json ./

RUN npm install

COPY ./src/db ./db

COPY ./src/utils/cronjobs.ts ./utils

COPY ./src/day.ts ./

COPY ./src/minute.ts ./
