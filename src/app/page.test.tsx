import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("home page", () => {
  it("renders the product and upload entry point", () => {
    render(<HomePage />);
    expect(screen.getByText("JSON Gen")).toBeInTheDocument();
    expect(screen.getByText("Solte sua planilha aqui")).toBeInTheDocument();
  });
});
