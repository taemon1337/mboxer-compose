FROM node

RUN npm install minio winston node-mbox mailparser

COPY ./ /app
WORKDIR /app

CMD node run.js
