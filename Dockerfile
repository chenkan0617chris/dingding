FROM node:16

WORKDIR /usr/dingding-server

COPY package*.json .
COPY config ./config
COPY data ./data
COPY src ./src
COPY tsconfig.json .
COPY processes.json .

RUN npm run build-docker

EXPOSE 8888

CMD [ "node", "./dist/index.js" ]