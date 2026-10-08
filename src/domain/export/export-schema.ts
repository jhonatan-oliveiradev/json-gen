import { z } from "zod";

export const exportOfferSchema = z.object({
  id: z.string().min(1),
  categoria_destino: z.string().min(1),
  Origem: z.string().min(1),
  iata_origem: z.string().regex(/^[A-Z0-9]{3}$/),
  Destino: z.string().min(1),
  iata_destino: z.string().regex(/^[A-Z0-9]{3}$/),
  Cia: z.string().min(1),
  conexao: z.string().nullable(),
  dropdown: z.string().min(1),
  valor_original: z.string(),
  clube_desconto: z.string(),
  Clube: z.string(),
  smiles_desconto: z.string().nullable(),
  Smiles: z.string().nullable(),
  data_saida: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  cliente_12x: z.string().nullable(),
  cliente_smiles_and_money: z.string().nullable(),
  cliente_total: z.string().nullable(),
  clube_12x: z.string().nullable(),
  clube_smiles_and_money: z.string().nullable(),
  clube_total: z.string().nullable(),
  Links: z.string().min(1),
  link_hotel: z.string(),
  link_img_desk: z.string().min(1),
  link_img_mobile: z.string().min(1),
  link_img_cia_aerea: z.string().min(1),
});

export type ExportOffer = z.infer<typeof exportOfferSchema>;
