# gene function

A [kubeless](https://kubeless.io) function to deploy in kubernetes cluster.

## Deploy

- Zip the required files

  > `$_> zip gene.zip *.js`

- deploy the function
  > `$_> kubeless function deploy \`  
  > `genefn --runtime nodejs8 --from-file gene.zip --handler handler.gene`  
  > `--dependencies package.json --namespace dictybase`

<em>Note: if you want to set a custom length for Redis cache expiration, you can use the env variable `REDIS_CACHE_EXPIRATION` (number must be in seconds). The default is set to 7 days.</em>

- check the status of function

  > `$_> kubeless function ls --namespace dictybase`

- to update the function, use:
  > `$_> kubeless function update \`  
  > `genefn --runtime nodejs8 --from-file gene.zip --handler handler.gene`  
  > `--dependencies package.json --namespace dictybase`

## Add a http trigger to create an ingress

> `$_> kubeless trigger http create genefn \`  
> `--function-name genefn --hostname betafunc.dictybase.local \`  
> `--tls-secret dictybase-local-tls --namespace dictybase --path genes`

The above command assumes a presence of tls secret`(dictybase-local-tls)` and mapping
to the host`(betafunc.dictybase.local)`.

## Endpoints

It will available through the mapped host, for example through
`betafunc.dictybase.local` assuming the above function.

`/genes/{id}` - Initial gene information for the given gene id.  
`/genes/{id}/goas` - Gene ontology annotations for the given gene id.

> `$_> curl -k https://betafunc.dictybase.local/genes/DDB_G0292996`

The gene id`({id})` refers to a dictybase gene id and all response will be in
JSON API format.
