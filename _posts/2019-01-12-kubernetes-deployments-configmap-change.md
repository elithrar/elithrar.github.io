---
layout: post
title: Updating Kubernetes Deployments on a ConfigMap Change
categories: kubernetes, tools, k8s
---

> **Update (June 2019)**: kubectl v1.15 now provides a [`rollout restart`](https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG-1.15.md#cli-improvements) sub-command that allows you to restart Pods in a `Deployment` - taking into account your surge/unavailability config - and thus have them pick up changes to a referenced `ConfigMap`, `Secret` or similar. It's worth noting that you can use this with clusters older than v1.15, as it's implemented in the client.
>
> Example usage: `kubectl rollout restart deploy/admission-control` to restart a specific deployment. Easy as that!

One initially non-obvious thing to me about Kubernetes was that changing a [ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/) (a set of configuration values) is not detected as a change to [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) (how a Pod, or set of Pods, should be deployed onto the cluster) or Pods that reference that configuration. That expectation can result in unintentionally stale configuration persisting until a change to the Pod spec. This could include freshly created Pods due to an autoscaling event, or even restarts after a crash, resulting in misconfiguration and unexpected behaviour across the cluster.

> Note: This doesn't impact ConfigMaps mounted as volumes, which are periodically synced by the
> kubelet running on each node.

Updating the `ConfigMap` and running `kubectl apply -f deployment.yaml` results in a no-op, which makes sense if you consider the impacts of an unintended config change and rollout in a larger deployment.

But, there are certainly cases where we want to:

- Update a ConfigMap
- Have our Deployment reference that specific ConfigMap version (in a version-control & CI friendly way)
- Rollout a new revision of our Deployment

So how can we accomplish that? It turns it out to be fairly straightforward, but let's step through an example.

## Example

Our ConfigMap, applied to our Kubernetes cluster:

```yaml
➜  less demo-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: demo-config
  namespace: default
data:
  READ_TIMEOUT_SECONDS: "15"
  WRITE_TIMEOUT_SECONDS: "15"
  NAME: "elithrar"
➜  kubectl apply -f demo-config.yaml
configmap/demo-config created
```

And here's our Deployment **before** we've referenced this version of our ConfigMap - notice the `spec.template.metadata.annotations.configHash` key we've added. It's important to note that modifying a top-level Deployment's `metadata.annotations` value is not sufficient: a Deployment will only re-create our Pods when the underlying `template.spec` (Pod spec) changes.

This is how we'll couple the Deployment with our ConfigMap, triggering a change in our Deployment *only* when our ConfigMap actually changes. 

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-deployment
  labels:
    app: config-demo-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: config-demo-app
  template:
    metadata:
      labels:
        app: config-demo-app
    annotations:
      # The field we'll use to couple our ConfigMap and Deployment
      configHash: ""
    spec:
      containers:
      - name: config-demo-app
        image: gcr.io/optimum-rock-145719/config-demo-app
        ports:
        - containerPort: 80
        envFrom:
        # The ConfigMap we want to use
        - configMapRef:
            name: demo-config
        # Extra-curricular: We can make the hash of our ConfigMap available at a
        # (e.g.) debug endpoint via a fieldRef
        env:
          - name: CONFIG_HASH
            valueFrom:
              fieldRef:
                fieldPath: spec.template.metadata.annotations.configHash
```

With these two pieces in mind, let's create a SHA-256 hash of our ConfigMap. Because this hash is deterministic (the same input == same output), the hash only changes when we change our configuration: making this a step we can unconditionally run as part of our deployment (CI/CD) pipeline into our Kubernetes cluster.

Note that I'm using [yq](https://mikefarah.github.io/yq/) (a CLI tool for YAML docs, like jq is to JSON) to modify our Deployment YAML at a specific path.

```sh
➜  yq w demo-deployment.yaml spec.template.metadata.annotations.configHash \
>  $(kubectl get cm/demo-config -oyaml | sha256sum)
...
spec:
  ...
  template:
    metadata:
      ...
      annotations:
        configHash: 4431f6d28fdf60c8140d28c42cde331a76269ac7a0e6af01d0de0fa8392c1145
```

We can now re-deploy our Deployment, and because our `spec.template` changed, Kubernetes will detect it as a change and re-create our Pods.

As a bonus, if we want to make a shortcut for this during development/local iteration, we can wrap this flow in a useful shell function:

```sh
# Invoke as hash-deploy-config deployment.yaml configHash myConfigMap
hash-deploy-config() {
  yq w $1 spec.template.metadata.annotations.$2 \
  $(kubectl get cm/$3 -oyaml | sha256sum)
}
```
