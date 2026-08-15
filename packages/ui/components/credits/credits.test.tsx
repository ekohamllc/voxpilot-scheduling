/* eslint-disable playwright/missing-playwright-await */
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import Credits from "./Credits";

vi.mock("@calcom/lib/constants", async () => {
  const actual = (await vi.importActual("@calcom/lib/constants")) as typeof import("@calcom/lib/constants");
  return {
    ...actual,
    CALCOM_VERSION: "mockedVersion",
  };
});

describe("Tests for Credits component", () => {
  test("Should render the VoxPilot powered-by attribution without a cal.com link", () => {
    render(<Credits />);

    expect(screen.getByText(/Powered by VoxPilot Scheduling/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /VoxPilot/i })).not.toBeInTheDocument();
  });

  test("Should render the copyright year and company name", () => {
    render(<Credits />);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear} VoxPilot`))).toBeInTheDocument();
  });

  test("Should render the version stamp without a cal.com releases link", () => {
    render(<Credits />);

    expect(screen.getByText(/mockedVersion/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /mockedVersion/i })).not.toBeInTheDocument();
  });
});
