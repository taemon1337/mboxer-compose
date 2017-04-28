FROM node

RUN apt-get purge --auto-remove -y tesseract-ocr antiword unrtf poppler-utils \
    && rm -rf /var/cache/apt/*

# sharp       - image processing
# textaract   - extract text from docs, pdfs, etc
# node-mbox   - parses mbox files
# mailparser  - parses emails
# minio       - object storage js client
RUN npm install busboy yauzl sharp textract node-mbox mailparser minio vcf

COPY ./ /web
WORKDIR /web

RUN node run.js
