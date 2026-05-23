import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { makeTempWorkspace, writeWorkspaceFile } from "../../../test-helpers/workspace.js";
import type { AgentBootstrapHookContext } from "../../hooks.js";
import { createHookEvent } from "../../hooks.js";
import handler from "./handler.js";

function createBootstrapExtraConfig(paths: string[]): OpenClawConfig {
  return {
    hooks: {
      internal: {
        entries: {
          "bootstrap-extra-files": {
            enabled: true,
            paths,
          },
        },
      },
    },
  };
}

async function createBootstrapContext(params: {
  workspaceDir: string;
  cfg: OpenClawConfig;
  sessionKey: string;
  rootFiles: Array<{ name: string; content: string }>;
}): Promise<AgentBootstrapHookContext> {
  const bootstrapFiles = (await Promise.all(
    params.rootFiles.map(async (file) => ({
      name: file.name,
      path: await writeWorkspaceFile({
        dir: params.workspaceDir,
        name: file.name,
        content: file.content,
      }),
      content: file.content,
      missing: false,
    })),
  )) as AgentBootstrapHookContext["bootstrapFiles"];
  return {
    workspaceDir: params.workspaceDir,
    bootstrapFiles,
    cfg: params.cfg,
    sessionKey: params.sessionKey,
  };
}

describe("bootstrap-extra-files hook", () => {
  it("appends extra bootstrap files from configured patterns", async () => {
    const tempDir = await makeTempWorkspace("openclaw-bootstrap-extra-");
    const extraDir = path.join(tempDir, "packages", "core");
    await fs.mkdir(extraDir, { recursive: true });
    await fs.writeFile(path.join(extraDir, "AGENTS.md"), "extra agents", "utf-8");

    const cfg = createBootstrapExtraConfig(["packages/*/AGENTS.md"]);
    const context = await createBootstrapContext({
      workspaceDir: tempDir,
      cfg,
      sessionKey: "agent:main:main",
      rootFiles: [{ name: "AGENTS.md", content: "root agents" }],
    });

    const event = createHookEvent("agent", "bootstrap", "agent:main:main", context);
    await handler(event);

    const injected = context.bootstrapFiles.filter((f) => f.name === "AGENTS.md");
    expect(injected).toHaveLength(2);
    expect(injected.map((f) => path.relative(tempDir, f.path))).toContain(
      path.join("packages", "core", "AGENTS.md"),
    );
  });

  it("re-applies subagent bootstrap allowlist after extras are added", async () => {
    const tempDir = await makeTempWorkspace("openclaw-bootstrap-extra-subagent-");
    const extraDir = path.join(tempDir, "packages", "persona");
    await fs.mkdir(extraDir, { recursive: true });
    await fs.writeFile(path.join(extraDir, "SOUL.md"), "evil", "utf-8");

    const cfg = createBootstrapExtraConfig(["packages/*/SOUL.md"]);
    const context = await createBootstrapContext({
      workspaceDir: tempDir,
      cfg,
      sessionKey: "agent:main:subagent:abc",
      rootFiles: [
        { name: "AGENTS.md", content: "root agents" },
        { name: "TOOLS.md", content: "root tools" },
      ],
    });

    const event = createHookEvent("agent", "bootstrap", "agent:main:subagent:abc", context);
    await handler(event);
    expect(context.bootstrapFiles.map((f) => f.name).toSorted()).toEqual(["AGENTS.md", "TOOLS.md"]);
  });

  it("keeps shared customization regressions visible across run kinds", async () => {
    const tempDir = await makeTempWorkspace("openclaw-bootstrap-extra-custom-");
    const customizationDir = path.join(tempDir, "customizations");
    await fs.mkdir(customizationDir, { recursive: true });
    await fs.writeFile(
      path.join(customizationDir, "AGENTS.md"),
      [
        "signature presence: require the canonical visible reply signature",
        "task capture: persist requested work before replying",
      ].join("\n"),
      "utf-8",
    );
    await fs.writeFile(
      path.join(customizationDir, "TOOLS.md"),
      "selector persistence: keep durable selector choices before acting",
      "utf-8",
    );
    await fs.writeFile(
      path.join(customizationDir, "MEMORY.md"),
      "memory hydration: load private long-term memory only in main sessions",
      "utf-8",
    );

    const cfg = createBootstrapExtraConfig([
      "customizations/AGENTS.md",
      "customizations/TOOLS.md",
      "customizations/MEMORY.md",
    ]);
    const sessions = [
      "agent:main:main",
      "agent:main:cron:daily:run:run-1",
      "agent:main:subagent:abc",
    ];

    for (const sessionKey of sessions) {
      const context = await createBootstrapContext({
        workspaceDir: tempDir,
        cfg,
        sessionKey,
        rootFiles: [
          { name: "AGENTS.md", content: "root agents" },
          { name: "TOOLS.md", content: "root tools" },
        ],
      });

      const event = createHookEvent("agent", "bootstrap", sessionKey, context);
      await handler(event);

      const content = context.bootstrapFiles.map((f) => f.content ?? "").join("\n");
      expect(content).toContain("signature presence");
      expect(content).toContain("task capture");
      expect(content).toContain("selector persistence");
      expect(content.includes("memory hydration")).toBe(sessionKey === "agent:main:main");
    }
  });
});
