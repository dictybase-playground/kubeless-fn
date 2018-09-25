# geneids function

A Node.js based [kubeless](https://kubeless.io) function to deploy in kubernetes cluster.

## Dependencies

[Redis](https://redis.io) and [minio](https://minio.io) have to be installed
for the function to work. The instructions are given
[here](https://github.com/dictyBase/Migration/blob/master/deploy.md#redis) and
[here](https://github.com/dictyBase/Migration/blob/master/deploy.md#object-storages3-compatible).

## Pre-deploy setup

### Upload file to object storage(minio)

Either use the minio web interface or use the minio command line
[tool](https://docs.minio.io/docs/minio-client-quickstart-guide.html)

Add host

> `$_> mc config host add locals3 $(minikube service --url minio --namespace dictybase) ACCESS_KEY SECRET_KEY`

Create bucket

> `$_> mc mb locals3/geneids`

Upload file to any folder inside that bucket

> `$_> mc cp canonical.gff3 locals3/geneids/`

The above bucket and folder path are for example only, any name could be used instead.

### Create metadata json file

This file specifies the file location in the object storage.

```json
{
  "bucket": "geneids",
  "file": "canonical_core.gff3"
}
```

## Deploy

- deploy the cachefn function

  > `$_> kubeless function deploy \`  
  > `cachefn --runtime nodejs8 --from-file handler.js --handler handler.file2redis`  
  > `--dependencies package.json --namespace dictybase -e MINIO_ACCESS_KEY=YOUR_KEY -e MINIO_SECRET_KEY=YOUR_KEY`

<em>Note: you also need to ensure `REDIS_MASTER_SERVICE_HOST`, `REDIS_MASTER_SERVICE_PORT`, `MINIO_SERVICE_HOST` and `MINIO_SERVICE_PORT` are set as well.</em>

- check the status of the function

  > `$_> kubeless function ls --namespace dictybase`

- to update the function, use:
  > `$_> kubeless function update \`  
  > `cachefn --runtime nodejs8 --from-file handler.js --handler handler.file2redis`  
  > `--dependencies package.json --namespace dictybase`

## Add a http trigger to create an ingress

> `$_> kubeless trigger http create cachefn \`  
> `--function-name cachefn --hostname betafunc.dictybase.local \`  
> `--tls-secret dictybase-local-tls --namespace dictybase --path goa/cache`

The above command assumes a presence of tls secret`(dictybase-local-tls)` and mapping
to the host`(betafunc.dictybase.local)`.

## Deploy

- deploy the gene2namefn function

  > `$_> kubeless function deploy \`  
  > `gene2namefn --runtime nodejs8 --from-file handler.js --handler handler.gene2name`  
  > `--dependencies package.json --namespace dictybase`

<em>Note: you also need to ensure `REDIS_MASTER_SERVICE_HOST` and `REDIS_MASTER_SERVICE_PORT` are set as well.</em>

## Add a http trigger to create an ingress

> `$_> kubeless trigger http create gene2namefn \`  
> `--function-name gene2namefn --hostname betafunc.dictybase.local \`  
> `--tls-secret dictybase-local-tls --namespace dictybase --path goa/converter`

The above command assumes a presence of tls secret`(dictybase-local-tls)` and mapping
to the host`(betafunc.dictybase.local)`.

## Endpoints

It will available through the mapped host, for example through
`betafunc.dictybase.local` assuming the above function.

**POST** `/goa/cache` - Stores gene ID and name as key-value pairs in Redis cache.
It will use `metadata.json` file to download the gff3 file from object storage and
persist the information in redis cache. An example `HTTP` request to this endpoint
will look like this.

> `$_> curl -k -X POST https://betafunc.dictybase.local/goa/cache -H 'Content-Type: application/json' -d @metadata.json`

**GET** `/goa/converter/{gene_id}` - Gets the gene name for a given gene ID.

> `$_> curl -k https://betafunc.dictybase.local/goa/converter/DDB_G0288511`

```json
{
  "data": {
    "type": "genes",
    "id": "DDB_G0288511",
    "attributes": {
      "geneName": "sadA",
      "geneId": "DDB_G0288511"
    }
  }
}
```
