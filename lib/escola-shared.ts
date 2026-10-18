/** Escola helpers shared by the server and the screens. */

export const MAX_LIVE_IDEAS = 3;
export const bastiaoLabel = (bastiao: { number: number | null; name: string }) => `${bastiao.number ? `Nº ${bastiao.number} · ` : ""}${bastiao.name}`;
