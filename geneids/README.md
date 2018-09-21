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

Deployment information coming soon...
