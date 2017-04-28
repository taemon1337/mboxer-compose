FROM node:alpine

RUN npm install bluebird minio yauzl temp winston

COPY ./ /app
WORKDIR /app

CMD node run.js
