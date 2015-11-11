# Requirements
- [Docker](https://docs.docker.com/installation/).
- [docker-compose](https://docs.docker.com/compose/install/).

# Run Docker images
The compose file consists of 3 containers:
- MongoDB Container.
- Elasticsearch Container.
- ChessHive Container.

```
$ git clone https://github.com/benas/gamehub.io.git
$ cd gamhub.io/docker
$ sudo docker-compose up
```

# Edit Services Addresses

By default the ChessHive Docker image will try to connect to Mongodb at Host (mongo) and port (27017) and to Elasticsearch at host (elasticsearch) and port (9200), to change that edit the following file:

### docker/chesshive/config/default.json:
```
{
    "chesshive": {
        "db": "mongodb://mongo/test",
        "es": {
             "host": "elasticsearch",
             "port": "9200"
        }
    }
}
```
# Volumes and data persistence 

By default the compose file is configured to map volumes of both MongoDB, and Elasticsearch to /data/db and /usr/share/elasticsearch/data respictively.

To change this behavior you can edit the compose file to mount the volumes to other place.