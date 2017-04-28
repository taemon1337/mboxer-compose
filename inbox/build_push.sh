#!/bin/bash

name=inbox:minio
image=registry.swarm/dfs/$name
docker build -t $image .
docker push $image

