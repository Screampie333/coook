import { authFetch } from "@/components/auth/hooks";

/**
 * Menyimpan caption AI yang dipakai sebuah meme (dipakai galeri /menu dan /kitchen).
 * null = tanpa caption, atau caption tulisan sendiri (teksnya belum disimpan karena belum ada moderasi).
 *
 * @returns false kalau gagal. Kegagalan di sini tidak menghentikan apa pun.
 */
export async function recordCaptionChoice(memeId: string, captionIndex: number | null): Promise<boolean> {
  try {
    const response = await authFetch(`/api/memes/${memeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captionIndex }),
    });
    if (!response.ok) {
      console.warn("[coook] could not save the caption choice:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[coook] could not save the caption choice:", error);
    return false;
  }
}
