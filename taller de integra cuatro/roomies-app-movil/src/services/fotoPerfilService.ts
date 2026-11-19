import type { ImagePickerAsset } from "expo-image-picker";
import { solicitarFormulario } from "@/services/httpClient";
import { fotoDisponible } from "@/services/usuariosService";
import { motivoRechazoFoto } from "@/utils/validarFotoPublicacion";

export function prepararFoto(asset: ImagePickerAsset) {
  const mime = asset.file?.type || asset.mimeType;
  const nombre = asset.file?.name || asset.fileName || asset.uri.split(/[?#]/)[0];
  const extension = nombre.split(".").pop()?.toLowerCase();
  const porExtension: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const tipo = mime?.toLowerCase() || porExtension[extension ?? ""];
  const rechazo = motivoRechazoFoto({ ...asset, mimeType: tipo, fileSize: asset.file?.size ?? asset.fileSize }, 5_000_000);
  if (!tipo || rechazo === "formato") return { error: "Elige una imagen JPEG, PNG o WebP." } as const;
  if (rechazo === "tamano") return { error: "La imagen supera los 5.000.000 bytes." } as const;
  const type = tipo === "image/jpg" ? "image/jpeg" : tipo;
  return { archivo: { uri: asset.uri, type, name: "perfil." + type.slice(6), file: asset.file } } as const;
}

export type FotoPerfilElegida = NonNullable<ReturnType<typeof prepararFoto>["archivo"]>;

export async function guardarFotoPerfil(foto: FotoPerfilElegida, identidad: string) {
  const cuerpo = new FormData();
  // Web entrega File y React Native consume el descriptor de archivo local.
  cuerpo.append("foto", foto.file ?? ({ uri: foto.uri, type: foto.type, name: foto.name } as unknown as Blob));
  const resultado = await solicitarFormulario("/api/usuarios/me/foto", { metodo: "PUT", cuerpo, identidadEsperada: identidad });
  if (!resultado.exito) return resultado;
  const datos = resultado.datos;
  const url = datos && typeof datos === "object" && "foto_perfil" in datos && typeof datos.foto_perfil === "string"
    ? fotoDisponible(datos.foto_perfil) : null;
  if (!url) return { exito: false, error: "El servicio respondió sin una foto válida. Vuelve a consultar tu perfil." } as const;
  return { exito: true, url } as const;
}
