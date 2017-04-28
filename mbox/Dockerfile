FROM node

RUN npm install minio winston node-mbox mailparser js-data js-data-mongodb

COPY ./ /app
WORKDIR /app

CMD node run.js
