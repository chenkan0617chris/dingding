FROM node:12

WORKDIR /usr/src/app

COPY package*.json .
COPY . .

RUN npm run build-docker

EXPOSE 3335

CMD [ "node", "./build/index.js" ]