import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";

describe("DashboardPage", () => {
  it("renders owned and shared document sections", () => {
    render(
      <MemoryRouter>
        <DashboardPage
          user={{
            id: 1,
            email: "user@example.com",
            username: "user1",
            createdAt: new Date().toISOString()
          }}
          documentsBusy={false}
          createTitle=""
          createBusy={false}
          statusMessage="Ready"
          workspaceError=""
          owned={[
            {
              id: 1,
              title: "Owned doc",
              ownerUserId: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              role: "owner"
            }
          ]}
          shared={[
            {
              id: 2,
              title: "Shared doc",
              ownerUserId: 2,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              role: "viewer"
            }
          ]}
          onCreateTitleChange={vi.fn()}
          onCreateDocument={vi.fn()}
          onRefresh={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText("Owned doc")).toBeInTheDocument();
    expect(screen.getByText("Shared doc")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
