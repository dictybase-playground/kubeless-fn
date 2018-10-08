# goids function

A Node.js based [kubeless](https://kubeless.io) function to deploy in kubernetes cluster.

**Important:** This function does not need to be deployed at this time. This readme is just here as a reference point.

## Dependencies

[Redis](https://redis.io) must be installed for the function to work. The instructions are given
[here](https://github.com/dictyBase/Migration/blob/master/deploy.md#redis).

## Deploy

- Zip the required files
  > `$_> zip goids.zip *.js`

* deploy the goidsfn function
  > `kubeless function deploy goidsfn --runtime nodejs8 --from-file goids.zip --handler handler.go2name --dependencies package.json --namespace dictybase`

<em>Note: you also need to ensure `REDIS_MASTER_SERVICE_HOST` and `REDIS_MASTER_SERVICE_PORT` are set as well.</em>

- check the status of the function

  > `$_> kubeless function ls --namespace dictybase`

- to update the function, you can use `kubeless function update` rather than `deploy`.

## Add a http trigger to create an ingress

> `kubeless trigger http create goidsfn --function-name goidsfn --hostname betafunc.dictybase.local --tls-secret dictybase-local-tls --namespace dictybase --path goa/id`

The above command assumes a presence of tls secret`(dictybase-local-tls)` and mapping
to the host`(betafunc.dictybase.local)`.

## Endpoints

It will available through the mapped host, for example through
`betafunc.dictybase.local` assuming the above function.

**GET** `/goa/id/{go_id}` - Gets the GO name for a given GO ID.

> `$_> curl -k https://betafunc.dictybase.local/goa/id/GO:0030587`

```json
{
  "data": {
    "type": "goa",
    "id": "GO:0030587",
    "attributes": {
      "goName": "sorocarp development",
      "goId": "GO:0030587"
    }
  }
}
```
