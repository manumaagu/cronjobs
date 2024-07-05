FROM node:latest

WORKDIR /app

COPY *.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

ENTRYPOINT [ "npm", "run", "start" ]