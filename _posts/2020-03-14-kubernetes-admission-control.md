---
layout: post
title: "Admission Control: A helpful micro-framework for Kubernetes"
categories: opensource, kubernetes, k8s, golang
---

_Admission Control_ ([GitHub](https://github.com/elithrar/admission-control)) is a micro-framework written in Go for building and deploying [dynamic admission controllers](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/) for your Kubernetes clusters. It reduces the boilerplate needed to inspect, validate and/or reject the admission of objects to your cluster, allowing you to focus on writing the specific business logic you want to enforce.

> **What is an Admission Controller?**: When you deploy, update or otherwise change the state of a Kubernetes (k8s) cluster, your change needs to be validated by the control plane. By default, Kubernetes has [a number of built-in](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/#which-plugins-are-enabled-by-default) "admission controllers" that validate and (in some cases) enforce resource quotas, service account automation, and other cluster-critical tasks. Usefully, Kubernetes also supports [dynamic admission controllers](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/): that is, admission controllers you can write yourself.

For example, you can write admission controllers for:

- Validating that specific annotations are present on all of your Services - such as a valid DNS hostname on your company domain.
- Rejecting `Ingress` or `Service` objects that would create a public-facing load-balancer/VIP as part of a defense-in-depth approach for a private cluster
- Mutating fields: resolving container image tags into hashes for security, or generating side-effects such as pushing state or status updates into another system.

The last example - a [`MutatingWebhookConfiguration`](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/#mutatingadmissionwebhook) can be extremely powerful, but you should consider how mutating live objects might make troubleshooting more challenging down the road vs. rejecting admission outright.

### Writing Your Owna

Writing your own dynamic admission controller is fairly simple, and has three key parts:

1. The admission controller itself: a service running _somewhere_ (in-cluster or otherwise)
2. An [`admissioncontrol.AdmitFunc`](https://godoc.org/github.com/elithrar/admission-control#AdmitFunc) that performs the validation. An `AdmitFunc` has a `http.Handler` compatible wrapper that allows you to BYO Go webserver library.
3. A `ValidatingWebhookConfiguration` (or `Mutating...`) that defines what _Kinds_ of objects are checked against the controller, what methods (create, update, etc) and how failure should be handled.

If you're already familiar with Go, Kubernetes, and want to see the framework in action, here's a simple example that requires any `Service` have a specific annotation (key, value).

> The [README](https://github.com/elithrar/admission-control) contains step-by-step instructions for creating, configuring and running an admission controller on your cluster, as well as [sample](https://github.com/elithrar/admission-control/tree/master/samples) configurations to help you get started.

```go
// ServiceHasAnnotation is a simple validating AdmitFunc that inspects any kind:
// Service for a static annotation key & value. If the annotation does not
// match, or a non-Service object is sent to the AdmitFunc, admission will be
// rejected.
func ServiceHasAnnotation(requiredKey, requiredVal string) AdmitFunc {
    // Return a function of type AdmitFunc
    return func(admissionReview *admission.AdmissionReview) (*admission.AdmissionResponse, error) {
        kind := admissionReview.Request.Kind.Kind
        // Create an *admission.AdmissionResponse that denies by default.
        resp := &admission.AdmissionResponse{
          Allowed: false,
		      Result:  &metav1.Status{},
	      }

        // Create an object to deserialize our requests' object into.
        // If we get a type we can't decode - we will reject admission.
        // Our ValidatingWebhookConfiguration will be configured to only ...
        svc := core.Service{}
        deserializer := serializer.NewCodecFactory(runtime.NewScheme()).UniversalDeserializer()
        if _, _, err := deserializer.Decode(admissionReview.Request.Object.Raw, nil, &svc); err != nil {
          return nil, err
        }

        for k, v := svc.ObjectMeta.Annotations {
          if k == requiredKey && v == requiredVal {
            // Set resp.Allowed to true before returning your AdmissionResponse
            resp.Allowed = true
            break
          }
        }

        if !resp.Allowed {
          return resp, xerrors.Errorf("submitted %s is missing annotation (%s: %s)",
            kind, requiredKey, requiredVal)
        }

        return resp, nil
    }
}
```

We can now use the `AdmissionHandler` wrapper to translate HTTP request & responses for us. In this example, we're using [gorilla/mux](https://github.com/gorilla/mux) as our routing library, but since we satisfy the `http.Handler` type, you could use `net/http` as well.

You would deploy this as `Service` to your cluster: an admission controller is ultimately just a webserver that knows how to handle an `AdmissionRequest` and return an `AdmissionResponse`.

```go
r := mux.NewRouter().StrictSlash(true)
admissions := r.PathPrefix("/admission-control").Subrouter()
admissions.Handle("/enforce-static-annotation", &admissioncontrol.AdmissionHandler{
	AdmitFunc:  admissioncontrol.ServiceHasAnnotations("k8s.example.com", "hello-world"),
	Logger:     logger,
}).Methods(http.MethodPost)
```

You can hopefully see how powerful this is already.

We can decode our request into a native Kubernetes object (or a custom resource), parse an object, and match on any field we want to in order to enforce our business logic. We could easily make this more dynamic by feeding the admission controller itself a `ConfigMap` of values we want it to check for, instead of hard-coding the values into the service itself.

### Writing Our ValidatingWebhookConfiguration

A [`ValidatingWebhookConfiguration`](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#webhook-configuration) is what determines which admissions are sent to your webhook.

Using our example above, we'll create a simple configuration that validates all `Service` objects deployed in any `Namespace` across our cluster with an `enforce-annotations: "true"` label.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  # Create a namespace that we'll match on
  name: enforce-annotations-example
  labels:
    enforce-annotations: "true"
---
apiVersion: admissionregistration.k8s.io/v1beta1
kind: ValidatingWebhookConfiguration
metadata:
  name: enforce-static-annotations
webhooks:
  - name: enforce-static-annotations.questionable.services
    sideEffects: None
    # "Equivalent" provides insurance against API version upgrades/changes - e.g.
    # extensions/v1beta1 Ingress -> networking.k8s.io/v1beta1 Ingress
    # matchPolicy: Equivalent
    rules:
      - apiGroups:
          - "*"
        apiVersions:
          - "*"
        operations:
          - "CREATE"
          - "UPDATE"
        resources:
          - "services"
    namespaceSelector:
      matchExpressions:
        # Any Namespace with a label matching the below will have its
        # annotations validated by this admission controller
        - key: "enforce-annotations"
          operator: In
          values: ["true"]
    failurePolicy: Fail
    clientConfig:
      service:
        # This is the hostname our certificate needs in its Subject Alternative
        # Name array - name.namespace.svc
        # If the certificate does NOT have this name, TLS validation will fail.
        name: admission-control-service # the name of the Service when deployed in-cluster
        namespace: default
        path: "/admission-control/enforce-static-annotation"
      # This should be the CA certificate from your Kubernetes cluster
      # Use the below to generate the certificate in a valid format:
      # $ kubectl config view --raw --minify --flatten \
      #   -o jsonpath='{.clusters[].cluster.certificate-authority-data}'
      caBundle: "<snip>"
      # You can alternatively supply a URL to the service, as long as its reachable by the cluster.
      # url: "https://admission-control-example.questionable.services/admission-control/enforce-pod-annotations""
```

A `Service` that would match this configuration and be successfully validated would look like the below:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: public-service
  namespace: enforce-annotations
  annotations:
    "k8s.example.com": "hello-world"
spec:
  type: LoadBalancer
  selector:
    app: hello-app
  ports:
    - port: 8000
      protocol: TCP
      targetPort: 8080
```

Deploying a `Service` without the required annotation would return an error similar to the below:

```sh
Error from server: submitted Service is missing required annotation (k8s.example.com: hello-world)
```

... and reject admission. Because we also have `UPDATE` in our `.rules.operations` list, removing or otherwise modifying a previously-admitted `Service` would also be rejected if the annotation did not match.

### Things to Watch Out For

One important thing worth noting is that a "Pod" is not always a "Pod" - if you want to enforce (for example) that the value of `containers.image` in _any_ created Pod references a specific registry URL, you'll need to write logic that inspects the `PodTemplate` of a `Deployment`, `StatefulSet`, `DaemonSet` and other types that can indirectly create a `Pod`.

There is not currently (as of Kubernetes v1.17) a way to reference a _type_ regardless of how it is embedded in other objects: in order to combat this, default deny objects that you don't have explicit handling for.

Other best practices:

- You should also scope admission controllers to namespaces using the `.webhooks.namespaceSelector` field: this will allow you to automate which namespaces have certain admission controls applied. Applying controls to `kube-system` and other cluster-wide administrative namespaces can break your deployments.
- Make sure your admission controllers are reliable: running your admission controller as a `Deployment` with its own replicas will prevent downtime from the controller being unavailable.
- Test, test, test. Run both unit tests and integration tests to make sure your AdmitFuncs are behaving as expected. The Kubernetes API surface is large, and there are often multiple versions of an object in play (v1beta1, v1, etc) for a given Kubernetes version. See [the framework tests](https://github.com/elithrar/admission-control/blob/master/admit_funcs_test.go) for an example of how to test your own AdmitFuncs.

> **Note**: a project with a similar goal is [Open Policy Agent](https://www.openpolicyagent.org/docs/v0.12.2/kubernetes-admission-control/), which requires you to write policies in [Rego](https://blog.openpolicyagent.org/opas-full-stack-policy-language-caeaadb1e077), a query language/DSL. This can be useful for simpler policies, but I would argue that once you get into more complex policy matching, the ability to use k8s packages, types and a Turing-complete language (Go) is long-term beneficial to a large team.

### What's Next?

Take a look at the [README](https://github.com/elithrar/admission-control#built-in-admitfuncs) for Admission Control, including some of the built-in AdmitFuncs, for how more complex enforcement and object handling can be done. Contributions to the framework are also welcome!
