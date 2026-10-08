import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonGenWorkspace } from "./json-gen-workspace";

describe("XLSX upload dropzone", () => {
  it("shows a drop state and rejects a non-spreadsheet drop", () => {
    render(<JsonGenWorkspace />);
    const dropzone = screen.getByText("Solte sua planilha aqui").closest("label");
    expect(dropzone).not.toBeNull();

    fireEvent.dragOver(dropzone!, { dataTransfer: { dropEffect: "none" } });
    expect(screen.getByText("Solte para importar a planilha")).toBeInTheDocument();

    fireEvent.drop(dropzone!, {
      dataTransfer: { files: [new File(["content"], "notes.txt", { type: "text/plain" })] },
    });
    expect(screen.getByText("Solte sua planilha aqui")).toBeInTheDocument();
    expect(screen.getByText("Solte um arquivo XLSX ou XLS válido.")).toBeInTheDocument();
  });
});
