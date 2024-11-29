FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

ARG BUILD_NUMBER
ENV BUILD_NUMBER=${BUILD_NUMBER}

CMD ["node", "app.js"]