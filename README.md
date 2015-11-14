chesshive
==================================================

#### Prerequisites

* Node JS
* Mongo DB up and running on the default port (27017) and using the default database (test)
* ElasticSearch server up and running on the default port (9200)

#### Run the application

Build the UI
```
cd client/apps/hivechess
$> npm install
$> bower install
$> export NODE_ENV=development && grunt
```

Run
```
$> npm install
$> node initData.js
$> export NODE_ENV=development && node .
```

Browse the following address: `http://localhost:3000`

License
--------------------------------------
The project is licensed under the [MIT License](http://opensource.org/licenses/MIT).