import * as fs from "fs";
import * as path from "path";

describe("Production Dockerization & CD Pipeline Validation [UTB-18]", () => {
  const rootDir = path.resolve(__dirname, "../../../");

  describe("Root .dockerignore", () => {
    it("should exist and ignore build artifacts, cache, secrets, and frontend code", () => {
      const dockerignorePath = path.join(rootDir, ".dockerignore");
      expect(fs.existsSync(dockerignorePath)).toBe(true);

      const content = fs.readFileSync(dockerignorePath, "utf-8");
      expect(content).toContain("node_modules");
      expect(content).toContain("dist");
      expect(content).toContain(".git");
      expect(content).toContain(".turbo");
      expect(content).toContain(".env");
      expect(content).toContain("coverage");
      expect(content).toContain("docs");
      expect(content).toContain("apps/web/dist");
    });
  });

  describe("Multi-Stage Dockerfiles (api, realtime, worker)", () => {
    const services = [
      { name: "api", port: 3000, dockerfile: "docker/api.Dockerfile" },
      {
        name: "realtime",
        port: 3001,
        dockerfile: "docker/realtime.Dockerfile",
      },
      { name: "worker", port: 3002, dockerfile: "docker/worker.Dockerfile" },
    ];

    services.forEach(({ name, port, dockerfile }) => {
      describe(`${name} Dockerfile`, () => {
        const filePath = path.join(rootDir, dockerfile);

        it(`should exist at ${dockerfile}`, () => {
          expect(fs.existsSync(filePath)).toBe(true);
        });

        it("should contain all 4 required multi-stage targets", () => {
          const content = fs.readFileSync(filePath, "utf-8");
          expect(content).toMatch(/FROM\s+node:22-alpine\s+AS\s+deps/i);
          expect(content).toMatch(/FROM\s+deps\s+AS\s+build/i);
          expect(content).toMatch(/FROM\s+build\s+AS\s+prod-deps/i);
          expect(content).toMatch(/FROM\s+node:22-alpine\s+AS\s+production/i);
        });

        it("should configure non-root user, tini, and entrypoint in production stage", () => {
          const content = fs.readFileSync(filePath, "utf-8");
          expect(content).toContain("USER node");
          expect(content).toContain("apk add --no-cache tini");
          expect(content).toContain('ENTRYPOINT ["/sbin/tini", "--"]');
          expect(content).toContain('CMD ["node", "dist/main.js"]');
          expect(content).toContain(`EXPOSE ${port}`);
        });

        it("should configure healthcheck with busybox wget", () => {
          const content = fs.readFileSync(filePath, "utf-8");
          expect(content).toMatch(/HEALTHCHECK/);
          expect(content).toContain(`http://127.0.0.1:${port}/api/v1/health`);
          expect(content).toContain("wget -q --spider");
        });

        it("should not contain baked credentials or secrets", () => {
          const content = fs.readFileSync(filePath, "utf-8");
          expect(content).not.toMatch(/SECRET|PASSWORD/i);
        });
      });
    });
  });

  describe("Docker Compose Production Configuration", () => {
    const composePath = path.join(rootDir, "docker-compose.prod.yml");

    it("should exist and define production services targeting 'production'", () => {
      expect(fs.existsSync(composePath)).toBe(true);
      const content = fs.readFileSync(composePath, "utf-8");

      expect(content).toContain("api:");
      expect(content).toContain("realtime:");
      expect(content).toContain("worker:");
      expect(content).toContain("target: production");
      expect(content).toContain("postgres:");
      expect(content).toContain("pgbouncer:");
      expect(content).toContain("redis:");
      expect(content).toContain("mongo:");
      expect(content).toContain("elasticsearch:");
      expect(content).toContain("condition: service_healthy");
    });
  });

  describe("GitHub Actions CD Workflow (.github/workflows/cd.yml)", () => {
    const cdWorkflowPath = path.join(rootDir, ".github/workflows/cd.yml");

    it("should exist and trigger on CI Pipeline completion on main branch", () => {
      expect(fs.existsSync(cdWorkflowPath)).toBe(true);
      const content = fs.readFileSync(cdWorkflowPath, "utf-8");

      expect(content).toContain("workflow_run:");
      expect(content).toContain('workflows: ["CI Pipeline"]');
      expect(content).toContain("- completed");
      expect(content).toContain("- main");
      expect(content).toContain("github.event.workflow_run.head_sha");
    });

    it("should configure sequential concurrency and minimal permissions", () => {
      const content = fs.readFileSync(cdWorkflowPath, "utf-8");
      expect(content).toContain("concurrency:");
      expect(content).toContain("cancel-in-progress: false");
      expect(content).toContain("permissions:");
      expect(content).toContain("contents: read");
    });

    it("should deploy services via Railway CLI and run health check with backoff", () => {
      const content = fs.readFileSync(cdWorkflowPath, "utf-8");
      expect(content).toContain("@railway/cli");
      expect(content).toContain("railway up --service");
      expect(content).toContain("/api/v1/health");
      expect(content).toContain("MAX_ATTEMPTS=");
      expect(content).toContain("DELAY=");
    });
  });
});
