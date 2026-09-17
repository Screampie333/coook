import "server-only";

/** Dilempar kalau AI menilai idenya melanggar aturan Coook. */
export class IdeaRejectedError extends Error {
  constructor() {
    super("The idea was rejected by the Coook rules.");
    this.name = "IdeaRejectedError";
  }
}
