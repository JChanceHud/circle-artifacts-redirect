FROM node:alpine
MAINTAINER Chance Hudson

COPY ./build/index.js .

CMD ["node", "."]
