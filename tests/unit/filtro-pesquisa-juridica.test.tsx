import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { FiltroPesquisaJuridica } from "@/components/consultas/filtro-pesquisa-juridica";

afterEach(cleanup);

it("troca o termo ao mudar de área e envia a nova pesquisa", async () => {
  const user = userEvent.setup();
  render(
    <FiltroPesquisaJuridica
      area="consumidor"
      termo="direito do consumidor"
      numero="123"
      tribunal="tjma"
    />,
  );
  await user.selectOptions(screen.getByLabelText("Área jurídica"), "trabalhista");
  const campo = screen.getByLabelText("Termo para pesquisar no LexML") as HTMLInputElement;
  expect(campo).toHaveValue("direito trabalhista");
  const dados = new FormData(campo.form!);
  expect(dados.get("area")).toBe("trabalhista");
  expect(dados.get("termo")).toBe("direito trabalhista");
  expect(dados.get("numero")).toBe("123");
  expect(dados.get("tribunal")).toBe("tjma");
  await user.clear(campo);
  await user.type(campo, "rescisão indireta");
  expect(new FormData(campo.form!).get("termo")).toBe("rescisão indireta");
  await user.selectOptions(screen.getByLabelText("Área jurídica"), "");
  expect(campo).toHaveValue("");
});
