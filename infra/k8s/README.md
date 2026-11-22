# Kubernetes Cluster Manifests (`infra/k8s/`)

Production-ready Kubernetes manifests and Kustomize declarations for UrTicketBuddy, adhering to ADR-0002 (K3s / Kind / OCI Ampere A1).

## Manifest Directory Layout

| Manifest                      | Purpose                    | Details                                                                                              |
| ----------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `00-namespace.yaml`           | Namespace Isolation        | Creates isolated `urticketbuddy` namespace                                                           |
| `01-configmap.yaml`           | Production Configuration   | Environment properties (`NODE_ENV`, ports, DB hosts, CDN URL)                                        |
| `02-secrets.yaml`             | Sensitive Credentials      | Production secrets (`JWT_SECRET`, `MASTER_TICKET_SECRET`, passwords)                                 |
| `03-services.yaml`            | Internal Networking        | ClusterIP services for `api`, `realtime`, `web`, `postgres`, `mongo`, `redis`, `elasticsearch`       |
| `04-api-deployment.yaml`      | REST API Deployment        | RollingUpdate (2 replicas), health probes (`/api/v1/health`), resource limits                        |
| `05-realtime-deployment.yaml` | Realtime Gateway           | RollingUpdate (2 replicas), WebSocket cluster, health probes                                         |
| `06-worker-deployment.yaml`   | BullMQ Worker              | Recreate strategy (1 replica), queue consumer, health checks                                         |
| `07-web-deployment.yaml`      | React SPA Web Service      | Multi-stage Nginx Alpine container (2 replicas) serving Vite SPA                                     |
| `08-ingress.yaml`             | Ingress Reverse Proxy      | Nginx Ingress routing `/api` -> `api`, `/socket.io` -> `realtime`, `/` -> `web`                      |
| `09-hpa.yaml`                 | Horizontal Pod Autoscaling | HPA for `api` (2-10 pods) and `realtime` (2-8 pods) targeting 70% CPU / 80% Memory                   |
| `10-cronjobs.yaml`            | Automated CronJobs         | Daily Backup (`02:00 UTC`), Nightly Data Checker (`03:00 UTC`), Weekly DR Drill (`04:00 UTC Sunday`) |
| `kustomization.yaml`          | Declarative Kustomize      | Bundles entire manifest graph                                                                        |

## Validating on Local Kind / K3s Cluster

```bash
# 1. Create a local multi-node Kind cluster
kind create cluster --name urticketbuddy

# 2. Dry-run validate the manifests with Kustomize
kubectl kustomize infra/k8s

# 3. Apply all manifests declaratively
kubectl apply -k infra/k8s

# 4. Verify running pods, services, HPA, and CronJobs
kubectl get pods,svc,hpa,cronjob -n urticketbuddy
```
