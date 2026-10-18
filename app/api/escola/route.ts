import {
  addIdea, addPractice, createBastiao, createClass, deleteBastiao, deleteClass, deleteIdea, deletePractice,
  markIdea, sendIdea, updateBastiao, updateClass, updateIdea, updatePractice,
} from "@/lib/db/escola";
import { requireId, respond } from "@/lib/respond";

type Body = Record<string, unknown>;
const ACTIONS: Record<string, (userId: string, body: Body) => Promise<unknown>> = {
  criarAula: (userId, body) => createClass(userId, body),
  editarAula: (userId, body) => updateClass(userId, requireId(body), body),
  excluirAula: (userId, body) => deleteClass(userId, requireId(body)),
  criarBastiao: (userId, body) => createBastiao(userId, body),
  editarBastiao: (userId, body) => updateBastiao(userId, requireId(body), body),
  excluirBastiao: (userId, body) => deleteBastiao(userId, requireId(body)),
  criarIdeia: (userId, body) => addIdea(userId, requireId(body), body),
  editarIdeia: (userId, body) => updateIdea(userId, requireId(body), body),
  excluirIdeia: (userId, body) => deleteIdea(userId, requireId(body)),
  marcarIdeia: (userId, body) => markIdea(userId, requireId(body), body),
  enviarIdeia: (userId, body) => sendIdea(userId, requireId(body), body.to, body.question),
  criarVivencia: (userId, body) => addPractice(userId, requireId(body), body),
  editarVivencia: (userId, body) => updatePractice(userId, requireId(body), body),
  excluirVivencia: (userId, body) => deletePractice(userId, requireId(body)),
};

/** Every Escola change: `{ action, id, …fields }`. */
export const POST = (request: Request) => respond(request, (userId, body) => {
  const run = typeof body.action === "string" ? ACTIONS[body.action] : undefined;
  if (!run) throw new Error("Ação desconhecida.");
  return run(userId, body);
});
