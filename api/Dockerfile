FROM node:latest

RUN npm install express js-data js-data-mongodb

COPY ./ /work
WORKDIR /work

CMD node run.js
