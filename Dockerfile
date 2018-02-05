FROM node:alpine
MAINTAINER Chance Hudson

COPY ./index.js .

CMD ["node", "."]
