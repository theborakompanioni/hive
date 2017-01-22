FROM node:7-alpine
MAINTAINER Thebora Kompanioni

ENV NODE_ENV production

# Create app directory
RUN mkdir -p /app
WORKDIR /app

COPY ./ /app

RUN mkdir -p /app/logs/dev

EXPOSE 3000

CMD [ "node", "/app" ]

