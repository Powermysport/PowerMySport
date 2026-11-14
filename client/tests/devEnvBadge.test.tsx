// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevEnvBadge } from "@/components/layout/DevEnvBadge";

afterEach(() => {
  vi.unstubAllEnvs();
  document.title = "";
});

describe("DevEnvBadge", () => {
  it("marks the page and the tab title in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    document.title = "Season planner | PowerMySport";
    const { container } = render(<DevEnvBadge app="client" />);

    expect(container.querySelector("[data-dev-env='client']")).not.toBeNull();
    expect(container.textContent).toContain("DEV · client");
    expect(document.title).toBe("[DEV] Season planner | PowerMySport");
  });

  it("puts the prefix back when a page rewrites the title, without doubling it", async () => {
    vi.stubEnv("NODE_ENV", "development");
    document.title = "Rankings";
    render(<DevEnvBadge app="client" />);

    document.title = "Boys Under-16";
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.title).toBe("[DEV] Boys Under-16");
  });

  it("renders nothing and leaves the title alone in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    document.title = "Season planner | PowerMySport";
    const { container } = render(<DevEnvBadge app="client" />);

    expect(container.innerHTML).toBe("");
    expect(document.title).toBe("Season planner | PowerMySport");
  });
});
