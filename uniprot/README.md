# uniprot functions

Node.js based [kubeless](https://kubeless.io) functions to deploy in kubernetes cluster.

## Dependencies

[Redis](https://redis.io) and [minio](https://minio.io) have to be installed
for the function to work. The instructions are given
[here](https://github.com/dictyBase/Migration/blob/master/deploy.md#redis) and
[here](https://github.com/dictyBase/Migration/blob/master/deploy.md#object-storages3-compatible).

## Pre-deploy setup

### Upload file to object storage(minio)

Either use the minio web interface or use the minio command line
[tool](https://docs.minio.io/docs/minio-client-quickstart-guide.html)

**Important:** The file you need to use for this is inside our `Migration-Data` Box folder (`dicty.txt`).

Add host

> `$_> mc config host add locals3 $(minikube service --url minio --namespace dictybase) ACCESS_KEY SECRET_KEY`

Create bucket

> `$_> mc mb locals3/uniprot`

Upload file to any folder inside that bucket

> `$_> mc cp dicty.txt locals3/uniprot/`

The above bucket and folder path are for example only, any name could be used instead.

**Important:** make sure you change this bucket's [policy](https://docs.minio.io/docs/minio-client-complete-guide#policy) to `download`.

### Create metadata json file

This file specifies the file location in the object storage.

```json
{
  "bucket": "uniprot",
  "file": "dicty.txt"
}
```

## Deploy

- Zip the required files

  > `$_> zip uniprot.zip *.js`

- deploy the uniprotcachefn function

  > `$_> kubeless function deploy \`  
  > `uniprotcachefn --runtime nodejs8 --from-file handler.js --handler handler.txt2redis`  
  > `--dependencies package.json --namespace dictybase -e MINIO_ACCESS_KEY=YOUR_KEY -e MINIO_SECRET_KEY=YOUR_KEY`

<em>Note: you also need to ensure `REDIS_MASTER_SERVICE_HOST`, `REDIS_MASTER_SERVICE_PORT`, `MINIO_SERVICE_HOST` and `MINIO_SERVICE_PORT` are set as well.</em>

- check the status of the function

  > `$_> kubeless function ls --namespace dictybase`

- to update the function, use:
  > `$_> kubeless function update \`  
  > `uniprotcachefn --runtime nodejs8 --from-file handler.js --handler handler.txt2redis`  
  > `--dependencies package.json --namespace dictybase`

## Add a http trigger to create an ingress

> `$_> kubeless trigger http create uniprotcachefn \`  
> `--function-name uniprotcachefn --hostname betafunc.dictybase.local \`  
> `--tls-secret dictybase-local-tls --namespace dictybase --path goa/ucache`

The above command assumes a presence of tls secret`(dictybase-local-tls)` and mapping
to the host`(betafunc.dictybase.local)`.

## Deploy

- deploy the uniprot2namefn function

  > `$_> kubeless function deploy \`  
  > `uniprot2namefn --runtime nodejs8 --from-file handler.js --handler handler.uniprot2name`  
  > `--dependencies package.json --namespace dictybase`

<em>Note: you also need to ensure `REDIS_MASTER_SERVICE_HOST` and `REDIS_MASTER_SERVICE_PORT` are set as well.</em>

## Add a http trigger to create an ingress

> `$_> kubeless trigger http create uniprot2namefn \`  
> `--function-name uniprot2namefn --hostname betafunc.dictybase.local \`  
> `--tls-secret dictybase-local-tls --namespace dictybase --path goa/uniprot`

The above command assumes a presence of tls secret`(dictybase-local-tls)` and mapping
to the host`(betafunc.dictybase.local)`.

## Endpoints

It will available through the mapped host, for example through
`betafunc.dictybase.local` assuming the above function.

**POST** `/goa/ucache` - Stores Uniprot ID and gene name as key-value pairs in Redis cache.
It will use `metadata.json` file to download the text file from object storage and
persist the information in redis cache. An example `HTTP` request to this endpoint
will look like this.

> `$_> curl -k -X POST https://betafunc.dictybase.local/goa/ucache -H 'Content-Type: application/json' -d @metadata.json`

**GET** `/goa/uniprot/{uniprot_id}` - Gets the gene name for a given Uniprot ID.

> `$_> curl -k https://betafunc.dictybase.local/goa/uniprot/Q54NC6`

```json
{
  "data": {
    "type": "genes",
    "id": "Q54NC6",
    "attributes": {
      "geneName": "anapc1",
      "uniprotId": "Q54NC6"
    }
  }
}
```
