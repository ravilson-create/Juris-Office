import { describe, expect, it } from "vitest";
import { linkWhatsapp } from "@/lib/whatsapp";

describe("linkWhatsapp", () => {
  it("monta o link wa.me com código do Brasil + DDD + número (celular, 11 dígitos)", () => {
    expect(linkWhatsapp("11912345678")).toBe("https://wa.me/5511912345678");
  });

  it("monta o link wa.me com código do Brasil + DDD + número (fixo, 10 dígitos)", () => {
    expect(linkWhatsapp("1123456789")).toBe("https://wa.me/551123456789");
  });

  it("remove pontuação caso o telefone venha formatado", () => {
    expect(linkWhatsapp("(11) 91234-5678")).toBe("https://wa.me/5511912345678");
  });
});
