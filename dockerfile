FROM node:20.11.1

WORKDIR /app

COPY package.json ./

RUN npm install

COPY src src

RUN npm run build

ENTRYPOINT [ "npm", "run", "start" ]