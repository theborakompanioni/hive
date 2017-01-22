FROM node:7-alpine
MAINTAINER Thebora Kompanioni

ENV NODE_ENV development
ENV GITHUB_REPO https://github.com/theborakompanioni/hive.git

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Install software
RUN apk update && \
    apk upgrade && \
    apk add git

# Clone the conf files into the docker container
RUN git clone ${GITHUB_REPO} /app

RUN npm install bower -g
RUN npm install grunt -g
RUN npm install grunt-cli -g

RUN npm install

RUN (cd /app/client/apps/chesshive/ && npm install)
RUN (cd /app/client/apps/chesshive/ && bower --allow-root install)
RUN (cd /app/client/apps/chesshive/ && npm install grunt)
RUN (cd /app/client/apps/chesshive/ && npm install time-grunt jit-grunt)
RUN (cd /app/client/apps/chesshive/ && grunt build)

RUN cd /app

ENV NODE_ENV production

RUN mkdir -p /app/logs/dev

EXPOSE 3000

CMD [ "node", "./" ]

