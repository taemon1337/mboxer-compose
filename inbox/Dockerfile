FROM node:alpine

RUN npm install --production express busboy minio node-uuid moment winston

COPY ./ /web

WORKDIR /web

ENV INBOX_DATA=/inbox_data/ \
    PORT=8080

VOLUME $INBOX_DATA

CMD node run.js $INBOX_DATA
