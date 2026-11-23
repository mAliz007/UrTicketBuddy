import * as fs from "fs";
import * as path from "path";

describe("Kubernetes Manifests & Orchestration Validation [UTB-19]", () => {
  const rootDir = path.resolve(__dirname, "../../../");
  const k8sDir = path.join(rootDir, "infra", "k8s");

  it("should have all required k8s manifest files and kustomization", () => {
    const requiredFiles = [
      "00-namespace.yaml",
      "01-configmap.yaml",
      "02-secrets.yaml",
      "03-services.yaml",
      "04-api-deployment.yaml",
      "05-realtime-deployment.yaml",
      "06-worker-deployment.yaml",
      "07-web-deployment.yaml",
      "08-ingress.yaml",
      "09-hpa.yaml",
      "10-cronjobs.yaml",
      "kustomization.yaml",
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(k8sDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    }
  });

  describe("Namespace & Config", () => {
    it("should define urticketbuddy namespace", () => {
      const content = fs.readFileSync(
        path.join(k8sDir, "00-namespace.yaml"),
        "utf-8",
      );
      expect(content).toContain("kind: Namespace");
      expect(content).toContain("name: urticketbuddy");
    });

    it("should configure core environment in ConfigMap", () => {
      const content = fs.readFileSync(
        path.join(k8sDir, "01-configmap.yaml"),
        "utf-8",
      );
      expect(content).toContain('NODE_ENV: "production"');
      expect(content).toContain('POSTGRES_HOST: "postgres-service"');
      expect(content).toContain('REDIS_HOST: "redis-service"');
      expect(content).toContain(
        'MONGO_URI: "mongodb://mongo-service:27017/urticketbuddy"',
      );
      expect(content).toContain('STORAGE_PROVIDER: "local"');
    });
  });

  describe("Horizontal Pod Autoscalers (HPA)", () => {
    it("should configure autoscaling for API and Realtime deployments", () => {
      const content = fs.readFileSync(
        path.join(k8sDir, "09-hpa.yaml"),
        "utf-8",
      );
      expect(content).toContain("kind: HorizontalPodAutoscaler");
      expect(content).toContain("name: utb-api-hpa");
      expect(content).toContain("name: utb-api");
      expect(content).toContain("minReplicas: 2");
      expect(content).toContain("maxReplicas: 10");
      expect(content).toContain("averageUtilization: 70");
      expect(content).toContain("name: utb-realtime-hpa");
      expect(content).toContain("name: utb-realtime");
      expect(content).toContain("maxReplicas: 8");
    });
  });

  describe("Automated CronJobs", () => {
    it("should configure daily backup, nightly data integrity check, and weekly DR drill", () => {
      const content = fs.readFileSync(
        path.join(k8sDir, "10-cronjobs.yaml"),
        "utf-8",
      );
      expect(content).toContain("kind: CronJob");
      expect(content).toContain("name: utb-backup-cronjob");
      expect(content).toContain('schedule: "0 2 * * *"');
      expect(content).toContain("backup-all.sh");

      expect(content).toContain("name: utb-nightly-data-check-cronjob");
      expect(content).toContain('schedule: "0 3 * * *"');
      expect(content).toContain("db:check:data");

      expect(content).toContain("name: utb-restore-drill-cronjob");
      expect(content).toContain('schedule: "0 4 * * 0"');
      expect(content).toContain("restore-drill.sh");
    });
  });

  describe("Deployments Health Probes & Resource Guardrails", () => {
    const deployments = [
      { file: "04-api-deployment.yaml", port: 3000, path: "/api/v1/health" },
      {
        file: "05-realtime-deployment.yaml",
        port: 3001,
        path: "/api/v1/health",
      },
      { file: "06-worker-deployment.yaml", port: 3002, path: "/api/v1/health" },
      { file: "07-web-deployment.yaml", port: 80, path: "/" },
    ];

    deployments.forEach(({ file, port, path: probePath }) => {
      it(`should specify resources, liveness, and readiness probes in ${file}`, () => {
        const content = fs.readFileSync(path.join(k8sDir, file), "utf-8");
        expect(content).toContain("resources:");
        expect(content).toContain("requests:");
        expect(content).toContain("limits:");
        expect(content).toContain("livenessProbe:");
        expect(content).toContain("readinessProbe:");
        expect(content).toContain(`port: ${port}`);
        expect(content).toContain(`path: ${probePath}`);
      });
    });
  });
});
